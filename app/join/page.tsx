"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Banner } from "@astryxdesign/core/Banner"
import { Button } from "@astryxdesign/core/Button"
import { Heading } from "@astryxdesign/core/Heading"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { Skeleton } from "@astryxdesign/core/Skeleton"
import { VStack } from "@astryxdesign/core/Stack"
import { Text } from "@astryxdesign/core/Text"
import { api, ApiError } from "@/lib/api"
import type { InvitePreview } from "@/lib/types"
import { AppShell } from "@/components/app-shell"

/**
 * Where an invitation link lands.
 *
 * The token is read but not spent until someone presses Join, so a person can
 * see whose workspace they are being asked to share — and sign in first if
 * they need to — without burning a single-use link. What joining means is
 * stated before the button, not after: the same library, the same connected
 * accounts.
 */

function JoinBody() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get("invite")

  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [failed, setFailed] = useState(false)
  const [joining, setJoining] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void api
      .previewInvite(token)
      .then((result) => {
        if (!cancelled) setPreview(result)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const join = async () => {
    if (!token || joining) return
    setProblem(null)
    setJoining(true)
    try {
      await api.acceptInvite(token)
      setJoined(true)
      router.push("/team")
    } catch (cause) {
      // The API's refusals are already written for people — "sign in first",
      // "already in a workspace with other people" — so repeat them.
      setProblem(cause instanceof ApiError ? cause.message : "Couldn't join just now. Try again.")
      setJoining(false)
    }
  }

  if (!token) {
    return (
      <Text as="p" type="body" color="secondary" display="block">
        This page needs an invitation link. Ask whoever invited you to send it again.
      </Text>
    )
  }
  if (failed) {
    return <p className="text-sm text-error">Couldn't check that invitation. Refresh to try again.</p>
  }
  if (preview === null) {
    return <Skeleton height={100} radius={3} />
  }
  if (!preview.valid) {
    return (
      <Banner
        status="warning"
        title="That invitation is no longer good"
        description="It may have expired, been withdrawn, or already been used. Ask for a fresh one."
      />
    )
  }

  return (
    <VStack gap={4} align="start">
      {problem && <Banner status="error" title="Couldn't join" description={problem} />}
      {joined && (
        <Banner status="success" title="You're in" description="Taking you to the team…" />
      )}
      <Text as="p" type="body" display="block">
        You've been invited to join <strong>{preview.workspaceName}</strong> on CLIPIT.
      </Text>
      <Text as="p" type="supporting" display="block">
        Joining means you share the same videos and clips, and can publish to the same connected accounts.
        You'll need to be signed in as the person accepting — use Sign in at the top right first if you
        aren't.
      </Text>
      <Button label="Join the workspace" variant="primary" isLoading={joining} onClick={() => void join()} />
    </VStack>
  )
}

export default function JoinPage() {
  return (
    <AppShell active="team">
      <Layout height="auto" contentWidth={560}>
        <LayoutContent padding={6}>
          <VStack gap={4} align="stretch">
            <Heading level={1}>Join a workspace</Heading>
            {/* useSearchParams needs a Suspense boundary in the app router. */}
            <Suspense fallback={<Skeleton height={100} radius={3} />}>
              <JoinBody />
            </Suspense>
          </VStack>
        </LayoutContent>
      </Layout>
    </AppShell>
  )
}
