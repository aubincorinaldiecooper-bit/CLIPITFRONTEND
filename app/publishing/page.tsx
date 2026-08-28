"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  PlusSignIcon,
  PodcastIcon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons"
import { api, ApiError } from "@/lib/api"
import type { SocialAccount, SocialAccountsPage } from "@/lib/types"
import { WorkspaceShell } from "@/components/workspace/shell"
import { Notice } from "@/components/workspace/notice"
import { PlatformLogo } from "@/components/platform-logos"
import {
  useAuthConfigured,
  useWorkspaceResumeIntent,
  useWorkspaceSignInGate,
} from "@/components/workspace/sign-in-gate"

/**
 * Publishing, on the app shell the Shared screens proved out: connect the
 * accounts you post to, see them plainly, and disconnect them. Clips are
 * published from the library — this page owns the connections.
 *
 * The honest states, spelled out rather than papered over:
 * - Publishing not configured on this deployment → one sentence, no buttons.
 * - Signed out → the designed empty state with the action in it. A social
 *   account bound to a guest tab would be stranded when it closed.
 * - The OAuth return lands here with ?connected= or ?connect_error= — and
 *   repeats exactly what the backend VERIFIED, never what it hoped. Success
 *   is a toast (the account is visible below; a permanent green box restating
 *   it only takes up the page); a failure is a Notice, because it has to sit
 *   still while you read it.
 */

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X",
}
const PLATFORMS = ["tiktok", "instagram", "youtube", "x"] as const

/** The icon well every panel on this page leads with. */
function IconWell({ icon }: { icon: typeof PodcastIcon }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-shmuted text-muted-foreground">
      <HugeiconsIcon icon={icon} className="size-[18px]" />
    </span>
  )
}

/**
 * The OAuth return, reported.
 *
 * Success is a TOAST, not a banner: it is news that something worked, the
 * account is now visible in the list right below, and a permanent green box
 * restating it just takes up the page until you navigate away. Failures stay
 * as Notices — those need to sit still while you read them and decide what
 * to do.
 */
function CallbackBanner() {
  const params = useSearchParams()
  const connected = params.get("connected")
  const error = params.get("connect_error")
  const platform = params.get("platform")
  /** The page that was added, when the backend could identify which one. */
  const account = params.get("account")
  const announced = useRef<string | null>(null)

  useEffect(() => {
    if (!connected) return
    if (announced.current === connected) return
    announced.current = connected
    // Name the PAGE, not the platform. You connect an account, and with two
    // Instagram pages "Instagram is connected" cannot say which one you just
    // added. Falls back to the platform only when the backend could not
    // identify the account — better than naming the wrong one.
    toast.success(
      account
        ? `${account} is connected.`
        : `${PLATFORM_LABELS[connected] ?? connected} is connected.`,
    )

    // Consume the parameter: a ref only survives THIS mount, and ?connected=
    // stays in history — so coming back with Back would announce a connection
    // that happened ages ago. replaceState edits the entry in place, so Back
    // still goes where it should.
    const url = new URL(window.location.href)
    url.searchParams.delete("connected")
    url.searchParams.delete("platform")
    url.searchParams.delete("account")
    window.history.replaceState(window.history.state, "", url.toString())
  }, [connected, account])

  if (error === "nothing_new") {
    // The backend compared the account list before and after this attempt
    // and saw no change — an older account was already connected, but this
    // attempt itself added nothing. Saying "connected" here would be a lie.
    return (
      <Notice
        tone="warning"
        title={`${platform ? PLATFORM_LABELS[platform] ?? platform : "That platform"} was already connected`}
        description="This attempt didn't add anything new. If you meant to add a different account, try again and finish the sign-in with the platform."
      />
    )
  }
  if (error === "subscription_required") {
    return (
      <Notice
        tone="warning"
        title="Connecting needs a plan upgrade"
        description="The publishing provider requires a subscription before another account can be connected."
      />
    )
  }
  if (error) {
    return (
      <Notice
        tone="error"
        title={`Couldn't connect ${platform ? PLATFORM_LABELS[platform] ?? platform : "the account"}`}
        description="The sign-in with the platform didn't complete. Nothing was connected — try again."
      />
    )
  }
  return null
}

function PublishingBody() {
  const [page, setPage] = useState<SocialAccountsPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  /**
   * The header's "Connect accounts" is the only action on this page that does
   * not already name a platform, so it has to ask which one. The rows below it
   * each carry their own Connect.
   */
  const [chooserOpen, setChooserOpen] = useState(false)
  /** The platform whose connect modal is open, and whether this is a
   *  fresh connection or a reconnect of a flagged account. */
  const [connectTarget, setConnectTarget] = useState<{ platform: string; reconnect: boolean } | null>(null)
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { requireSignIn, askToSignIn } = useWorkspaceSignInGate()
  const authConfigured = useAuthConfigured()

  useEffect(() => {
    let cancelled = false
    void api
      .listSocialAccounts()
      .then((result) => {
        if (!cancelled) setPage(result)
      })
      .catch((cause) => {
        if (cancelled) return
        // A backend without this endpoint yet (this frontend deployed first)
        // answers 404 — that is "publishing isn't switched on here", not a
        // loading failure, and the page should say so.
        if (cause instanceof ApiError && cause.status === 404) {
          setPage({ configured: false, signInRequired: false, accounts: [] })
        } else {
          setFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Open the modal that explains the journey before starting it. */
  const askToConnect = (platform: string, reconnect = false) => {
    setActionError(null)
    setConnectTarget({ platform, reconnect })
  }

  /**
   * Connecting needs a person: an account bound to a guest tab would be
   * stranded the moment that tab closed. The prompt asks, and coming back
   * from it reopens the platform they were connecting rather than dropping
   * them on the page with no memory of it.
   */
  const askToConnectSignedIn = (platform: string, reconnect = false) =>
    requireSignIn({ action: "connect", platform }, () => askToConnect(platform, reconnect))

  /**
   * The header's Connect, gated before the chooser rather than after it.
   *
   * Picking a platform and only then being told to sign in wastes the choice
   * and asks the same question one step too late. The intent carries no
   * platform because none has been picked yet — coming back from the email
   * link reopens the chooser, which is where they were.
   */
  const askToChooseSignedIn = () =>
    requireSignIn({ action: "connect", platform: "any" }, () => setChooserOpen(true))

  useWorkspaceResumeIntent(
    (intent) => intent.action === "connect",
    (intent) => {
      if (intent.action !== "connect") return
      // "any" is the header's Connect, which had not picked a platform yet.
      if (intent.platform === "any") setChooserOpen(true)
      else askToConnect(intent.platform)
    },
  )

  /**
   * Which connect attempt is the live one. Closing the modal, or starting a
   * different platform, retires whatever was in flight: a connect URL that
   * arrives afterwards must not seize the browser and send someone into a
   * journey they cancelled — or worse, into the wrong platform's.
   */
  const attemptRef = useRef(0)

  const closeConnect = () => {
    attemptRef.current += 1
    setConnecting(null)
    setConnectTarget(null)
  }

  const connect = async (platform: string) => {
    setActionError(null)
    setConnecting(platform)
    const attempt = (attemptRef.current += 1)
    try {
      const { url } = await api.getConnectUrl(platform)
      if (attemptRef.current !== attempt) return
      window.location.assign(url)
    } catch (cause) {
      if (attemptRef.current !== attempt) return
      setConnecting(null)
      // The modal stays open with the reason, so trying again is one click.
      setActionError(
        cause instanceof ApiError ? cause.message : "Couldn't start the connection. Try again.",
      )
    }
  }

  const disconnect = async (account: SocialAccount) => {
    setActionError(null)
    setBusyAccountId(account.id)
    try {
      await api.disconnectSocialAccount(account.id)
      setPage((current) =>
        current
          ? {
              ...current,
              accounts: current.accounts.map((entry) =>
                entry.id === account.id ? { ...entry, status: "disconnected" } : entry,
              ),
            }
          : current,
      )
    } catch (cause) {
      // The row stays "connected" because it still is — the revoke failed.
      setActionError(
        cause instanceof ApiError ? cause.message : "Couldn't disconnect that account. Try again.",
      )
    } finally {
      setBusyAccountId(null)
    }
  }

  if (failed) {
    return <p className="text-sm text-destructive">Couldn&apos;t load your accounts. Refresh to try again.</p>
  }
  if (page === null) {
    return <Skeleton className="h-[120px] w-full rounded-xl" />
  }
  if (!page.configured) {
    return (
      <p className="text-sm text-muted-foreground">
        Publishing isn&apos;t switched on for this deployment yet. Until it is, every clip in your
        library downloads as a ready-to-post MP4.
      </p>
    )
  }
  if (page.signInRequired) {
    // The app's designed empty state, with the action in it — the same shape
    // the Shared page uses for its signed-out moment.
    return (
      <Card className="flex flex-1 items-center justify-center border-dashed">
        <CardContent className="flex max-w-md flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-shmuted text-muted-foreground">
            <HugeiconsIcon icon={PodcastIcon} className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Your accounts are waiting</h2>
          <p className="text-sm text-muted-foreground">
            Connected accounts belong to you, not to a browser tab.{" "}
            {authConfigured === false
              ? "Sign-in isn't switched on for this deployment yet."
              : "Sign in and they'll be here every time you come back."}
          </p>
          {/* Only where sign-in can actually work — on a guest-only
              deployment the button would open a form whose send must fail. */}
          {authConfigured && (
            <Button className="mt-2" onClick={askToSignIn}>
              Sign in
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const connectedAccounts = page.accounts.filter((account) => account.status !== "disconnected")

  return (
    <div className="flex flex-col gap-5">
      {actionError && !connectTarget && (
        <Notice tone="error" title="That didn't work" description={actionError} />
      )}

      {/* Two panels, as the design has them: what you have connected, and why
          you would. The four platforms are the same rows in the empty and the
          populated state, so the page never rearranges itself. */}
      <Card>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <IconWell icon={PodcastIcon} />
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">Connected accounts</h2>
                <p className="text-sm text-muted-foreground">
                  Link your social accounts to publish clips with one click.
                </p>
              </div>
            </div>
            <Button onClick={askToChooseSignedIn}>
              <HugeiconsIcon icon={PlusSignIcon} />
              Connect accounts
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-shborder">
            <ul>
              {PLATFORMS.map((platform, index) => (
                <li
                  key={platform}
                  className={
                    "flex items-center gap-3 px-4 py-3 " +
                    (index > 0 ? "border-t border-shborder" : "")
                  }
                >
                  <PlatformLogo platform={platform} size="sm" />
                  {/* The name alone: "Publish clips directly to TikTok" beside
                      a Connect button on a page called Publishing said nothing
                      the reader had not already worked out. */}
                  <span className="text-sm font-medium">{PLATFORM_LABELS[platform]}</span>
                  <Button
                    // Always "Connect" — one word, steady in both states, per
                    // the owner. The platform goes in the accessible name:
                    // four buttons reading "Connect" and nothing else are
                    // indistinguishable to anyone who cannot see the row.
                    aria-label={`Connect ${PLATFORM_LABELS[platform]}`}
                    variant="secondary"
                    size="sm"
                    className="ml-auto"
                    onClick={() => askToConnectSignedIn(platform)}
                  >
                    Connect
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          {connectedAccounts.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {connectedAccounts.length} {connectedAccounts.length === 1 ? "account" : "accounts"} connected
              </p>
              <div className="overflow-hidden rounded-lg border border-shborder">
                <ul>
                  {connectedAccounts.map((account, index) => (
                    <li
                      key={account.id}
                      className={
                        "flex flex-wrap items-center gap-3 px-4 py-3 " +
                        (index > 0 ? "border-t border-shborder" : "")
                      }
                    >
                      <PlatformLogo platform={account.platform} size="sm" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {account.displayName ?? "Connected account"}
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                          {PLATFORM_LABELS[account.platform] ?? account.platform}
                        </span>
                      </div>
                      <div className="ml-auto flex items-center gap-3">
                        {/* A state, said with a dot and words — never colour
                            alone. */}
                        {account.status === "reconnect_required" ? (
                          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                            <span className="size-2 rounded-full bg-destructive" aria-hidden />
                            Needs reconnecting
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                            <span className="size-2 rounded-full bg-emerald-600" aria-hidden />
                            Connected
                          </span>
                        )}
                        {account.status === "reconnect_required" ? (
                          <Button size="sm" onClick={() => askToConnectSignedIn(account.platform, true)}>
                            Reconnect
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyAccountId === account.id}
                            onClick={() => void disconnect(account)}
                          >
                            {busyAccountId === account.id ? "Disconnecting…" : "Disconnect"}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PlatformChooser
        isOpen={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onPick={(platform: string) => {
          setChooserOpen(false)
          askToConnectSignedIn(platform)
        }}
      />

      <ConnectDialog
        target={connectTarget}
        connecting={connecting}
        actionError={actionError}
        onClose={closeConnect}
        onContinue={(platform) => void connect(platform)}
      />
    </div>
  )
}

/**
 * Which platform the header's Connect is for.
 *
 * A short list rather than a full modal: it is a choice between four things
 * the person can already see on the page, so it wants to be quick and to get
 * out of the way, not to be a second screen.
 */
function PlatformChooser({
  isOpen,
  onClose,
  onPick,
}: {
  isOpen: boolean
  onClose: () => void
  onPick: (platform: string) => void
}) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="shadcn-scope sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Connect an account</DialogTitle>
          <DialogDescription>Pick where you want to post.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg border border-shborder">
          <ul>
            {PLATFORMS.map((platform, index) => (
              <li key={platform}>
                <button
                  type="button"
                  onClick={() => onPick(platform)}
                  className={
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-shaccent focus-visible:bg-shaccent focus-visible:outline-none " +
                    (index > 0 ? "border-t border-shborder" : "")
                  }
                >
                  <PlatformLogo platform={platform} size="sm" />
                  <span className="text-sm font-medium">{PLATFORM_LABELS[platform]}</span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="ml-auto size-4 text-muted-foreground"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The moment before leaving CLIPIT: a modal that says what happens next —
 * a secure approval page, the platform's own sign-in, then straight back —
 * and starts the journey only from its Continue button.
 *
 * Deliberately provider-anonymous: the publishing service CLIPIT uses is
 * an implementation detail, and the owner asked for it scrubbed from
 * every user-facing surface.
 */
function ConnectDialog({
  target,
  connecting,
  actionError,
  onClose,
  onContinue,
}: {
  target: { platform: string; reconnect: boolean } | null
  connecting: string | null
  actionError: string | null
  onClose: () => void
  onContinue: (platform: string) => void
}) {
  const label = target ? PLATFORM_LABELS[target.platform] ?? target.platform : ""
  const title = target?.reconnect ? `Reconnect ${label}` : `Connect ${label}`
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="shadcn-scope sm:max-w-[480px]">
        {target && (
          <div className="flex flex-col gap-6">
            <PlatformLogo platform={target.platform} />
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {target.reconnect
                  ? `This account needs a fresh sign-in — posts can't go out until it's reconnected.`
                  : `Publish clips directly to ${label}.`}
              </DialogDescription>
            </DialogHeader>

            {actionError && <Notice tone="error" title="That didn't work" description={actionError} />}

            {/* One button, full width, saying where it goes. The promise that
                matters is the one below, which is about the password. */}
            <Button
              size="lg"
              className="w-full"
              disabled={connecting === target.platform}
              onClick={() => onContinue(target.platform)}
            >
              {connecting === target.platform ? "Opening…" : `Continue with ${label}`}
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground">
              <HugeiconsIcon icon={SquareLock01Icon} className="size-4" />
              You&apos;ll sign in securely on {label}.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function PublishingPage() {
  return (
    <WorkspaceShell active="publishing">
      <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Publishing</h1>
          <p className="text-sm text-muted-foreground">
            Connect the accounts you post to, then send clips straight from your library.
          </p>
        </div>
        {/* useSearchParams needs a Suspense boundary in the app router. */}
        <Suspense fallback={null}>
          <CallbackBanner />
        </Suspense>
        <PublishingBody />
      </div>
    </WorkspaceShell>
  )
}
