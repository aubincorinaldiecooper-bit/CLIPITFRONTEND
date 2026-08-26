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
import { Grid } from "@astryxdesign/core/Grid"
import { ArrowRightGlyph, LockGlyph, PlusGlyph } from "@/components/glyphs"
import { BarsGlyph, BoltGlyph, BroadcastGlyph, PersonGlyph, SparkGlyph } from "@/components/feature-glyphs"
import { IconWell, SectionCard } from "@/components/section-card"
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
  x: "X",
}
const PLATFORMS = ["tiktok", "instagram", "youtube", "x"] as const

/**
 * Why anyone would connect an account at all.
 *
 * Straight from the owner's design. It answers the question somebody asks
 * before handing over access to an account that is often their livelihood, and
 * answering it on the page beats making them guess.
 */
const WHY_CONNECT = [
  {
    icon: BoltGlyph,
    title: "Publish faster",
    body: "Skip the extra steps and post straight from CLIPIT.",
  },
  {
    icon: BarsGlyph,
    title: "Track performance",
    body: "See how your clips perform across connected platforms.",
  },
  {
    icon: PersonGlyph,
    title: "Keep accounts saved",
    body: "We'll keep your accounts secure for effortless publishing.",
  },
] as const

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
  /**
   * The header's "Connect accounts" is the only action on this page that does
   * not already name a platform, so it has to ask which one. The rows below it
   * each carry their own Connect; this exists because the design puts a
   * primary action in the header, and a primary action that cannot say what it
   * will do would be worse than one that asks.
   */
  const [chooserOpen, setChooserOpen] = useState(false)
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

  useResumeIntent(
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
  // There is no separate "nothing connected yet" screen any more. It used to
  // short-circuit this whole page into a centred EmptyState with a row of
  // Connect buttons — which meant the empty state and the populated state were
  // two different layouts, and the four platforms appeared in a different
  // shape depending on whether you had any. The owner's design makes the two
  // cards below the empty state: the same four rows, each already carrying its
  // own Connect. Nothing is lost and the page stops rearranging itself.

  return (
    <VStack gap={5} align="stretch">
      {actionError && !connectTarget && (
        <Banner status="error" title="That didn't work" description={actionError} />
      )}

      {/* Two panels, as the design has them: what you have connected, and
          why you would. It replaces a card per platform — that grouping
          answered "which platforms, and what do I have on each" but spread
          four small cards down the page where the design has one list. The
          accounts still nest under their platform, because the design shows
          the empty state and dropping them would lose what somebody has. */}
      <SectionCard
        icon={BroadcastGlyph}
        title="Connected accounts"
        description="Link your social accounts to publish clips with one click."
        action={
          <Button
            label="Connect accounts"
            variant="primary"
            icon={<Icon icon={PlusGlyph} size="sm" />}
            onClick={askToChooseSignedIn}
          />
        }
      >
        <Card variant="muted" padding={0}>
          <List hasDividers>
            {PLATFORMS.map((platform) => {
              const mine = connectedAccounts.filter((account) => account.platform === platform)
              return (
                <ListItem
                  key={platform}
                  startContent={<PlatformLogo platform={platform} size="sm" />}
                  label={PLATFORM_LABELS[platform]}
                  description={`Publish clips directly to ${PLATFORM_LABELS[platform]}`}
                  endContent={
                    <Button
                      // Always "Connect". It read "Connect another" once one
                      // existed, which made the same control change its name —
                      // and the owner's call is that one word, steady in both
                      // states, is easier to find than a more precise one that
                      // moves.
                      label="Connect"
                      // Four buttons reading "Connect" and nothing else are
                      // indistinguishable to anyone who cannot see which row
                      // they are in. The design wants the one steady word on
                      // screen, so the platform goes in the accessible name
                      // instead of the label.
                      aria-label={`Connect ${PLATFORM_LABELS[platform]}`}
                      variant="secondary"
                      onClick={() => askToConnectSignedIn(platform)}
                    />
                  }
                />
              )
            })}
          </List>
        </Card>

        {connectedAccounts.length > 0 && (
          <VStack gap={2} align="stretch">
            <Text as="p" type="body" color="secondary" display="block">
              {connectedAccounts.length} {connectedAccounts.length === 1 ? "account" : "accounts"} connected
            </Text>
            {/* Accounts are dense data, so they are rows — the repo rule is
                List/Item for a repeated collection, never a Card each. */}
            <Card variant="muted" padding={0}>
              <List hasDividers>
                {connectedAccounts.map((account) => (
                  <ListItem
                    key={account.id}
                    startContent={<PlatformLogo platform={account.platform} size="sm" />}
                    label={account.displayName ?? "Connected account"}
                    description={PLATFORM_LABELS[account.platform] ?? account.platform}
                    endContent={
                      <HStack gap={3} align="center">
                        {/* StatusDot, not Badge: this is a state, and Badge is
                            reserved for counts here. */}
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
            </Card>
          </VStack>
        )}
      </SectionCard>

      <SectionCard icon={SparkGlyph} title="Why connect accounts?">
        {/* Three equal columns that divide the card, not a responsive pack:
            `minWidth` bunched them into a narrow band on the left while the
            right half of the card sat empty, and every description wrapped to
            four lines. They collapse to one column on a narrow viewport. */}
        <Grid columns={{ minWidth: 280, max: 3 }} gap={0}>
          {WHY_CONNECT.map((reason, index) => (
            <HStack
              key={reason.title}
              gap={3}
              align="start"
              // A rule between the columns, as the design draws it, and never
              // before the first one.
              className={index > 0 ? "sm:border-l sm:border-border sm:pl-6" : "sm:pr-6"}
            >
              <IconWell icon={reason.icon} size="sm" />
              <VStack gap={0.5}>
                <Text as="span" weight="medium" display="block">
                  {reason.title}
                </Text>
                <Text as="p" type="body" color="secondary" display="block">
                  {reason.body}
                </Text>
              </VStack>
            </HStack>
          ))}
        </Grid>
      </SectionCard>

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
    </VStack>
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
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      purpose="info"
      width={420}
      padding={5}
      aria-label="Connect an account"
    >
      <VStack gap={4} align="stretch">
        <VStack gap={1} align="stretch">
          <Heading level={1} accessibilityLevel={2}>
            Connect an account
          </Heading>
          <Text as="p" type="body" color="secondary" display="block">
            Pick where you want to post.
          </Text>
        </VStack>
        <Card variant="muted" padding={0}>
          <List hasDividers>
            {PLATFORMS.map((platform) => (
              <ListItem
                key={platform}
                startContent={<PlatformLogo platform={platform} size="sm" />}
                label={PLATFORM_LABELS[platform]}
                onClick={() => onPick(platform)}
                endContent={<Icon icon={ArrowRightGlyph} size="sm" />}
              />
            ))}
          </List>
        </Card>
      </VStack>
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
      isOpen={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      purpose="info"
      // Measured off the mockup once the two were normalised to the same
      // scale: the card is 543px there against the 440 this had, and every
      // gap inside it is roughly twice what the design system gives by
      // default. The layout was right and the density was not.
      width={540}
      padding={8}
      aria-label={title}
    >
      {target && (
        <VStack gap={6} align="stretch">
          <HStack justify="between" align="start">
            <PlatformLogo platform={target.platform} />
            <IconButton
              icon={<Icon icon="close" />}
              label="Close"
              variant="ghost"
              // Its own well, as in the mockup — a bare X on a flat panel has
              // nothing to aim at.
              className="rounded-full ring-1 ring-border"
              onClick={onClose}
            />
          </HStack>

          <VStack gap={2} align="stretch">
            <Heading level={1} accessibilityLevel={2}>
              {title}
            </Heading>
            <Text as="p" type="body" color="secondary" display="block">
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
            size="lg"
            endContent={<Icon icon={ArrowRightGlyph} />}
            isLoading={connecting === target.platform}
            onClick={() => onContinue(target.platform)}
          />

          <HStack gap={1.5} justify="center" align="center">
            <Icon icon={LockGlyph} size="sm" />
            <Text as="span" type="supporting">
              You&apos;ll sign in securely on {label}.
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
      <Layout height="auto" contentWidth={1213}>
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
