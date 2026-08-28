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
import { WORKSPACES_CHANGED_EVENT } from "@/components/side-nav"

/**
 * Where an invitation link lands.
 *
 * The token is read but not spent until someone presses Join, so a person can
 * see which room they are being asked into — and sign in first if they need
 * to — without burning a single-use link. What joining means is stated before
 * the button, not after: you see what is sent to the room, and your own
 * library stays yours.
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
  const [already, setAlready] = useState(false)

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
      const result = await api.acceptInvite(token)
      window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT))
      setJoined(true)
      // Already a member: the invitation was not spent, and saying "you're
      // in" would be true but confusing. Say which it was.
      setAlready(Boolean(result.alreadyMember))
      router.push("/shared")
    } catch (cause) {
      // The API's refusals are already written for people — "sign in first",
      // "that invitation has expired" — so repeat them rather than rephrase.
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
        <Banner
          status="success"
          title={already ? "You're already in this room" : "You're in"}
          description="Taking you to your shared rooms…"
        />
      )}
      <Text as="p" type="body" display="block">
        You've been invited to join <strong>{preview.workspaceName}</strong> on CLIPIT.
      </Text>
      <Text as="p" type="supporting" display="block">
        Joining means you see the clips people send to this room, and you can send clips there
        from your own library. Your library itself stays yours — joining shares nothing automatically.
      </Text>
      <Text as="p" type="supporting" display="block">
        You'll need to be signed in as the person accepting — use Sign in at the top right first if you
        aren't. You'll come straight back here.
      </Text>
      <Button label="Join the room" variant="primary" isLoading={joining} onClick={() => void join()} />
    </VStack>
  )
}

export default function JoinPage() {
  return (
    <AppShell active="workspaces">
      <Layout height="fill" contentWidth={560}>
        <LayoutContent padding={6}>
          <VStack gap={4} align="stretch">
            <Heading level={1}>Join a room</Heading>
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
