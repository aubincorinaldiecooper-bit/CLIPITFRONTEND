"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Card } from "@astryxdesign/core/Card"
import { Center } from "@astryxdesign/core/Center"
import { Divider } from "@astryxdesign/core/Divider"
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog"
import { EmptyState } from "@astryxdesign/core/EmptyState"
import { Heading } from "@astryxdesign/core/Heading"
import { Icon } from "@astryxdesign/core/Icon"
import { IconButton } from "@astryxdesign/core/IconButton"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { List, ListItem } from "@astryxdesign/core/List"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { StatusDot } from "@astryxdesign/core/StatusDot"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { useToast } from "@astryxdesign/core/Toast"
import { api, ApiError } from "@/lib/api"
import type { SocialAccount, SocialAccountsPage } from "@/lib/types"
import { AppShell } from "@/components/app-shell"
import { GhostRows } from "@/components/empty-illustrations"
import { LockGlyph } from "@/components/glyphs"
import { PlatformGlyph } from "@/components/platform-glyphs"
import { PlatformLogo } from "@/components/platform-logos"
import { useResumeIntent, useSignInGate } from "@/components/sign-in-gate"

/**
 * Publishing, now real: connect the accounts you post to, see them plainly,
 * and disconnect them. Clips are published from the library — this page owns
 * the connections.
 *
 * The honest states, spelled out rather than papered over:
 * - Publishing not configured on this deployment → one sentence, no buttons.
 * - Signed out → one sentence; the way in is the header's Sign in.
 *   A social account bound to a guest tab would be stranded when it closed.
 * - The OAuth return lands here with ?connected= or ?connect_error= — and
 *   repeats exactly what the backend VERIFIED, never what it hoped. Success
 *   is a toast (the account is visible below; a permanent green box restating
 *   it only takes up the page); a failure is a banner, because it has to sit
 *   still while you read it.
 */

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
}
const PLATFORMS = ["tiktok", "youtube", "instagram"] as const

/**
 * The OAuth return, reported.
 *
 * Success is a TOAST, not a banner: it is news that something worked, the
 * account is now visible in the list right below, and a permanent green box
 * restating it just takes up the page until you navigate away. Failures stay
 * as banners — those need to sit still while you read them and decide what
 * to do.
 */
function CallbackBanner() {
  const params = useSearchParams()
  const connected = params.get("connected")
  const error = params.get("connect_error")
  const platform = params.get("platform")
  /** The page that was added, when the backend could identify which one. */
  const account = params.get("account")
  const toast = useToast()
  const announced = useRef<string | null>(null)

  useEffect(() => {
    if (!connected) return
    if (announced.current === connected) return
    announced.current = connected
    // Name the PAGE, not the platform. You connect an account, and with two
    // Instagram pages "Instagram is connected" cannot say which one you just
    // added. Falls back to the platform only when the backend could not
    // identify the account — better than naming the wrong one.
    toast({
      body: account
        ? `${account} is connected.`
        : `${PLATFORM_LABELS[connected] ?? connected} is connected.`,
    })

    // Consume the parameter. Codex, P2: a ref only survives THIS mount, and
    // ?connected= stays in history — so leaving the page and coming back with
    // Back mounts a fresh component against the same URL and announces a
    // connection that happened ages ago. replaceState edits the entry in
    // place, so Back still goes where it should; it just no longer carries a
    // message that has already been delivered.
    const url = new URL(window.location.href)
    url.searchParams.delete("connected")
    url.searchParams.delete("platform")
    url.searchParams.delete("account")
    window.history.replaceState(window.history.state, "", url.toString())
  }, [connected, account, toast])

  if (error === "nothing_new") {
    // The backend compared the account list before and after this attempt
    // and saw no change — an older account was already connected, but this
    // attempt itself added nothing. Saying "connected" here would be a lie.
    return (
      <Banner
        status="warning"
        title={`${platform ? PLATFORM_LABELS[platform] ?? platform : "That platform"} was already connected`}
        description="This attempt didn't add anything new. If you meant to add a different account, try again and finish the sign-in with the platform."
      />
    )
  }
  if (error === "subscription_required") {
    return (
      <Banner
        status="warning"
        title="Connecting needs a plan upgrade"
        description="The publishing provider requires a subscription before another account can be connected."
      />
    )
  }
  if (error) {
    return (
      <Banner
        status="error"
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
  /** The platform whose connect modal is open, and whether this is a
   *  fresh connection or a reconnect of a flagged account. */
  const [connectTarget, setConnectTarget] = useState<{ platform: string; reconnect: boolean } | null>(null)
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { requireSignIn } = useSignInGate()

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

  useResumeIntent(
    (intent) => intent.action === "connect",
    (intent) => {
      if (intent.action === "connect") askToConnect(intent.platform)
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
    return <p className="text-sm text-error">Couldn't load your accounts. Refresh to try again.</p>
  }
  if (page === null) {
    return <Skeleton height={120} radius={3} />
  }
  if (!page.configured) {
    return (
      <Text as="p" type="body" color="secondary" display="block">
        Publishing isn't switched on for this deployment yet. Until it is, every clip in your
        library downloads as a ready-to-post MP4.
      </Text>
    )
  }
  if (page.signInRequired) {
    return (
      <Text as="p" type="body" color="secondary" display="block">
        Connected accounts belong to you, not to a browser tab — sign in (top right) and they'll
        be here every time you come back.
      </Text>
    )
  }

  const connectedAccounts = page.accounts.filter((account) => account.status !== "disconnected")

  // The first-account moment gets the whole stage: one empty state whose
  // actions ARE the connect buttons, instead of a bare sentence floating
  // above a distant section.
  if (connectedAccounts.length === 0) {
    return (
      <VStack gap={4} align="stretch">
        {/* Not while the connect dialog is open: it reports the same failure,
            and one problem shown twice on one screen reads as two problems.
            The dialog owns it, because that is where the action was taken. */}
        {actionError && !connectTarget && (
          <Banner status="error" title="That didn't work" description={actionError} />
        )}
        <Center minHeight="55vh">
        <EmptyState
          icon={<GhostRows />}
          title="Connect your first account"
          description="You'll sign in with the platform itself — CLIPIT never sees that password. Once connected, every ready clip in your library can publish straight to it."
          actions={
            <>
              {PLATFORMS.map((platform) => (
                <Button
                  key={platform}
                  label={`Connect ${PLATFORM_LABELS[platform]}`}
                  icon={<PlatformGlyph platform={platform} />}
                  variant="secondary"
                  onClick={() => askToConnectSignedIn(platform)}
                />
              ))}
            </>
          }
        />
        </Center>
        <ConnectDialog
          target={connectTarget}
          connecting={connecting}
          actionError={actionError}
          onClose={closeConnect}
          onContinue={(platform) => void connect(platform)}
        />
      </VStack>
    )
  }

  return (
    <VStack gap={5} align="stretch">
      {actionError && !connectTarget && (
        <Banner status="error" title="That didn't work" description={actionError} />
      )}

      {/* One card per platform, the accounts nested inside it.

          Before, every account was a flat row labelled with its platform, and
          the way to add one was a separate row of buttons further down — so
          "which platforms can I use, and what do I have on each" took reading
          two lists and joining them yourself. Grouping answers it in one
          glance: the platform is the heading, its accounts sit under it, and
          the action to add another is right there on the same card.

          Built from Astryx throughout — Card, Divider, List/ListItem, Stack.
          Codex was right that the first version was a raw div with inline
          styles: it would have drifted from every later theme change, and the
          repo's own rule is that components do the layout. */}
      {PLATFORMS.map((platform) => {
        const mine = connectedAccounts.filter((account) => account.platform === platform)
        return (
          <Card key={platform} variant="muted" padding={0}>
            <HStack justify="between" align="center" gap={3} className="px-4 py-3.5">
              <HStack gap={3} align="center">
                <PlatformLogo platform={platform} size="sm" />
                <Text as="span" weight="medium" display="block">
                  {PLATFORM_LABELS[platform]}
                </Text>
                {mine.length === 0 && (
                  <Text as="span" type="supporting" display="block">
                    Not connected
                  </Text>
                )}
              </HStack>
              <Button
                // Always "Connect". It read "Connect another" once one
                // existed, which made the same control change its name — and
                // the owner's call is that one word, steady in both states,
                // is easier to find than a more precise one that moves.
                label="Connect"
                variant={mine.length > 0 ? "secondary" : "primary"}
                size="sm"
                onClick={() => askToConnectSignedIn(platform)}
              />
            </HStack>

            {mine.length > 0 && (
              <>
                <Divider />
                {/* Accounts are dense data, so they are rows — the repo rule
                    is List/Item for a repeated collection, never a Card each. */}
                <List hasDividers>
                  {mine.map((account) => (
                    <ListItem
                      key={account.id}
                      label={account.displayName ?? "Connected account"}
                      // StatusDot, not Badge: this is a state, and Badge is
                      // reserved for counts here.
                      endContent={
                        <HStack gap={3} align="center">
                          {account.status === "reconnect_required" ? (
                            <StatusDot variant="error" label="Needs reconnecting" />
                          ) : (
                            <StatusDot variant="success" label="Connected" />
                          )}
                          {account.status === "reconnect_required" ? (
                            <Button
                              label="Reconnect"
                              variant="primary"
                              size="sm"
                              onClick={() => askToConnectSignedIn(account.platform, true)}
                            />
                          ) : (
                            <Button
                              label="Disconnect"
                              variant="secondary"
                              size="sm"
                              isLoading={busyAccountId === account.id}
                              onClick={() => void disconnect(account)}
                            />
                          )}
                        </HStack>
                      }
                    />
                  ))}
                </List>
              </>
            )}
          </Card>
        )
      })}

      <Text as="p" type="supporting" display="block">
        {connectedAccounts.length === 0
          ? "Nothing connected yet. You'll sign in with the platform itself; CLIPIT never sees that password."
          : `${connectedAccounts.length} ${connectedAccounts.length === 1 ? "account" : "accounts"} connected.`}
      </Text>

      <Text as="p" type="supporting" display="block">
        Publishing happens from your library: every ready clip has a Publish button that posts it
        to the accounts you pick.
      </Text>

      <ConnectDialog
        target={connectTarget}
        connecting={connecting}
        actionError={actionError}
        onClose={closeConnect}
        onContinue={(platform) => void connect(platform)}
      />
    </VStack>
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
      isOpen={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      purpose="info"
      width={440}
      aria-label={title}
    >
      {target && (
        <VStack gap={4} align="stretch">
          <HStack justify="between" align="start">
            <PlatformLogo platform={target.platform} />
            <IconButton
              icon={<Icon icon="close" />}
              label="Close"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          </HStack>

          <VStack gap={1} align="stretch">
            <Heading level={1} accessibilityLevel={2}>
              {title}
            </Heading>
            <Text as="p" type="supporting" display="block">
              {target.reconnect
                ? `This account needs a fresh sign-in — posts can't go out until it's reconnected.`
                : `Publish clips directly to ${label}.`}
            </Text>
          </VStack>

          {actionError && <Banner status="error" title="That didn't work" description={actionError} />}

          {/* One button, full width, saying where it goes. The modal used to
              spell out three numbered steps before it; the mockups cut them,
              and they were reassurance nobody had asked for — the promise
              that matters is the one below, which is about the password. */}
          <Button
            label={`Continue with ${label}`}
            variant="primary"
            width="100%"
            endContent={<Icon icon="chevronRight" />}
            isLoading={connecting === target.platform}
            onClick={() => onContinue(target.platform)}
          />

          <HStack gap={1.5} justify="center" align="center">
            <Icon icon={LockGlyph} size="sm" />
            <Text as="span" type="supporting">
              You&apos;ll sign in on {label} itself — CLIPIT never sees that password.
            </Text>
          </HStack>
        </VStack>
      )}
    </Dialog>
  )
}

export default function PublishingPage() {
  return (
    <AppShell active="publishing">
      <Layout height="auto" contentWidth={880}>
        <LayoutContent padding={6}>
          <VStack gap={4} align="stretch">
            <VStack gap={1.5}>
              <Heading level={1}>Publishing</Heading>
              <Text as="p" type="supporting" display="block">
                Connect the accounts you post to, then send clips straight from your library.
              </Text>
            </VStack>
            {/* useSearchParams needs a Suspense boundary in the app router. */}
            <Suspense fallback={null}>
              <CallbackBanner />
            </Suspense>
            <PublishingBody />
          </VStack>
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
