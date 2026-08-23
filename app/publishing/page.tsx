"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Card } from "@astryxdesign/core/Card"
import { Heading } from "@astryxdesign/core/Heading"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { HStack, VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { api, ApiError } from "@/lib/api"
import type { SocialAccount, SocialAccountsPage } from "@/lib/types"
import { AppShell } from "@/components/app-shell"

/**
 * Publishing, now real: connect the accounts you post to, see them plainly,
 * and disconnect them. Clips are published from the library — this page owns
 * the connections.
 *
 * The honest states, spelled out rather than papered over:
 * - Publishing not configured on this deployment → one sentence, no buttons.
 * - Signed out → one sentence; the way in is the header's Sign in.
 *   A social account bound to a guest tab would be stranded when it closed.
 * - The OAuth return lands here with ?connected= or ?connect_error= — the
 *   banner repeats exactly what the backend verified, never what it hoped.
 */

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
}
const PLATFORMS = ["tiktok", "youtube", "instagram"] as const

function CallbackBanner() {
  const params = useSearchParams()
  const connected = params.get("connected")
  const error = params.get("connect_error")
  const platform = params.get("platform")

  if (connected) {
    return (
      <Banner
        status="success"
        title={`${PLATFORM_LABELS[connected] ?? connected} is connected`}
        description="It appears below, and clips can publish to it from your library."
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
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .listSocialAccounts()
      .then((result) => {
        if (!cancelled) setPage(result)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const connect = async (platform: string) => {
    setActionError(null)
    setConnecting(platform)
    try {
      const { url } = await api.getConnectUrl(platform)
      window.location.assign(url)
    } catch (cause) {
      setConnecting(null)
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

  return (
    <VStack gap={5} align="stretch">
      {actionError && (
        <Banner status="error" title="That didn't work" description={actionError} />
      )}

      <VStack gap={2} align="stretch">
        <Heading level={2}>Connected accounts</Heading>
        {connectedAccounts.length === 0 ? (
          <Text as="p" type="supporting" display="block">
            Nothing connected yet — pick a platform below to connect your first account.
          </Text>
        ) : (
          connectedAccounts.map((account) => (
            <Card key={account.id} variant="muted" padding={3}>
              <HStack justify="between" align="center" gap={4} wrap="wrap">
                <VStack gap={0.5}>
                  <Text weight="medium">{PLATFORM_LABELS[account.platform] ?? account.platform}</Text>
                  <Text type="supporting">
                    {account.displayName ?? "Connected account"}
                    {account.status === "reconnect_required" ? " — needs reconnecting" : ""}
                  </Text>
                </VStack>
                {account.status === "reconnect_required" ? (
                  <Button
                    label="Reconnect"
                    variant="primary"
                    size="sm"
                    isLoading={connecting === account.platform}
                    onClick={() => void connect(account.platform)}
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
            </Card>
          ))
        )}
      </VStack>

      <VStack gap={2} align="stretch">
        <Heading level={2}>Connect a platform</Heading>
        <Text as="p" type="supporting" display="block">
          You'll sign in with the platform itself; CLIPIT never sees that password.
        </Text>
        <HStack gap={2} wrap="wrap">
          {PLATFORMS.map((platform) => (
            <Button
              key={platform}
              label={`Connect ${PLATFORM_LABELS[platform]}`}
              variant="secondary"
              isLoading={connecting === platform}
              onClick={() => void connect(platform)}
            />
          ))}
        </HStack>
      </VStack>

      <Text as="p" type="supporting" display="block">
        Publishing happens from your library: every ready clip has a Publish button that posts it
        to the accounts you pick.
      </Text>
    </VStack>
  )
}

export default function PublishingPage() {
  return (
    <AppShell active="publishing">
      <Layout height="auto" contentWidth={672}>
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
