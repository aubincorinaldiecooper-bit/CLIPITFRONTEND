"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "@astryxdesign/core/Badge"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Center } from "@astryxdesign/core/Center"
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog"
import { EmptyState } from "@astryxdesign/core/EmptyState"
import { Heading } from "@astryxdesign/core/Heading"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { List, ListItem } from "@astryxdesign/core/List"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { useToast } from "@astryxdesign/core/Toast"
import { api, ApiError } from "@/lib/api"
import type { SocialAccount, SocialAccountsPage } from "@/lib/types"
import { AppShell } from "@/components/app-shell"
import { GhostRows } from "@/components/empty-illustrations"
import { PlatformGlyph } from "@/components/platform-glyphs"

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
                  onClick={() => askToConnect(platform)}
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
          the action to add another is right there on the same card. */}
      {PLATFORMS.map((platform) => {
        const mine = connectedAccounts.filter((account) => account.platform === platform)
        return (
          <div
            key={platform}
            className="overflow-hidden rounded-[var(--radius-container)]"
            style={{
              backgroundColor: "var(--color-background-card)",
              boxShadow: "inset 0 0 0 1px var(--color-border)",
            }}
          >
            <HStack justify="between" align="center" gap={3} className="px-4 py-3.5">
              <HStack gap={3} align="center">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: "var(--color-background-surface)",
                    boxShadow: "inset 0 0 0 1px var(--color-border)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <PlatformGlyph platform={platform} />
                </span>
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
                // "Connect another" once there is one, because that is what
                // the button then does — a second account, not a first.
                label={mine.length > 0 ? "Connect another" : "Connect"}
                variant={mine.length > 0 ? "secondary" : "primary"}
                size="sm"
                onClick={() => askToConnect(platform)}
              />
            </HStack>

            {mine.length > 0 && (
              <div style={{ borderTop: "1px solid var(--color-border)" }}>
                {mine.map((account) => (
                  <HStack
                    key={account.id}
                    justify="between"
                    align="center"
                    gap={3}
                    className="px-4 py-3"
                  >
                    <HStack gap={2} align="center">
                      <Text as="span" display="block">
                        {account.displayName ?? "Connected account"}
                      </Text>
                      {/* Astryx's Badge, which is what the state pill in the
                          reference is. Text has no success/error colour, and
                          hand-rolling one would be a colour that never
                          follows the theme. */}
                      {account.status === "reconnect_required" ? (
                        <Badge variant="error" label="Needs reconnecting" />
                      ) : (
                        <Badge variant="success" label="Connected" />
                      )}
                    </HStack>
                    {account.status === "reconnect_required" ? (
                      <Button
                        label="Reconnect"
                        variant="primary"
                        size="sm"
                        onClick={() => askToConnect(account.platform, true)}
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
                ))}
              </div>
            )}
          </div>
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
  return (
    <Dialog
      isOpen={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      purpose="info"
      width={460}
    >
      <DialogHeader
        title={target?.reconnect ? `Reconnect ${label}` : `Connect ${label}`}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      />
      {target && (
        <VStack gap={3} align="stretch">
          {actionError && <Banner status="error" title="That didn't work" description={actionError} />}
          {target.reconnect && (
            <Text as="p" type="body" color="secondary" display="block">
              This account needs a fresh sign-in — posts can't go out until it's reconnected.
            </Text>
          )}
          <VStack gap={2} align="stretch">
            <Text as="p" type="body" display="block">
              1. You'll be taken to a secure page to approve the connection.
            </Text>
            <Text as="p" type="body" display="block">
              2. You sign in with {label} itself — CLIPIT never sees that password.
            </Text>
            <Text as="p" type="body" display="block">
              3. You land back here, connected — and every ready clip in your library can
              publish straight to it.
            </Text>
          </VStack>
          <HStack gap={2} justify="end">
            <Button label="Cancel" variant="ghost" onClick={onClose} />
            <Button
              label="Continue"
              variant="primary"
              isLoading={connecting === target.platform}
              onClick={() => onContinue(target.platform)}
            />
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
