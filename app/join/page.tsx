"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import type { InvitePreview } from "@/lib/types"
import { WorkspaceShell } from "@/components/workspace/shell"
import { WORKSPACES_CHANGED_EVENT } from "@/components/side-nav"
import { Notice } from "@/components/workspace/notice"

/**
 * Where an invitation link lands — on the app shell, like every screen now.
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
      <p className="text-sm text-muted-foreground">
        This page needs an invitation link. Ask whoever invited you to send it again.
      </p>
    )
  }
  if (failed) {
    return <p className="text-sm text-destructive">Couldn&apos;t check that invitation. Refresh to try again.</p>
  }
  if (preview === null) {
    return <Skeleton className="h-[100px] w-full rounded-xl" />
  }
  if (!preview.valid) {
    return (
      <Notice
        tone="warning"
        title="That invitation is no longer good"
        description="It may have expired, been withdrawn, or already been used. Ask for a fresh one."
      />
    )
  }

  return (
    <div className="flex flex-col items-start gap-4">
      {problem && <Notice tone="error" title="Couldn't join" description={problem} />}
      {joined && (
        <Notice
          tone="success"
          title={already ? "You're already in this room" : "You're in"}
          description="Taking you to your shared rooms…"
        />
      )}
      <p className="text-sm">
        You&apos;ve been invited to join <strong>{preview.workspaceName}</strong> on CLIPIT.
      </p>
      <p className="text-sm text-muted-foreground">
        Joining means you see the clips people send to this room, and you can send clips there
        from your own library. Your library itself stays yours — joining shares nothing automatically.
      </p>
      <p className="text-sm text-muted-foreground">
        You&apos;ll need to be signed in as the person accepting — use Sign in at the top right first
        if you aren&apos;t. You&apos;ll come straight back here.
      </p>
      <Button onClick={() => void join()} disabled={joining}>
        {joining ? "Joining…" : "Join the room"}
      </Button>
    </div>
  )
}

export default function JoinPage() {
  return (
    <WorkspaceShell active="workspaces">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Join a room</h1>
        {/* useSearchParams needs a Suspense boundary in the app router. */}
        <Suspense fallback={<Skeleton className="h-[100px] w-full rounded-xl" />}>
          <JoinBody />
        </Suspense>
      </div>
    </WorkspaceShell>
  )
}
