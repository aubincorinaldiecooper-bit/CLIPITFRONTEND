"use client"

import { useEffect, useState } from "react"
import { api, ApiError } from "@/lib/api"
import type { ClipPost } from "@/lib/types"

/**
 * What the Publish control says after it is pressed, read from the posts
 * themselves — never from the fact that the server accepted them.
 *
 * A publish makes one post per platform shape; the server's 202 names
 * them. From then on the clip's posts are asked every couple of seconds:
 * a post is on its way ('posting'), up on the platform's own word
 * ('posted'), or refused ('failed'). The control reads Uploading… while
 * any post is on its way, Published once every post is up, Try again when
 * something was refused, and — when the platforms' word is slow in coming
 * — Sent: the clip went, and CLIPIT will not say "published" of a post
 * nobody confirmed. An older server that cannot be asked reads as Sent at
 * once, for the same reason.
 */

export type PublishPhase = "idle" | "publishing" | "published" | "sent" | "failed"

/** How long the control waits for the platforms' word before it settles for Sent. */
export const PUBLISH_CONFIRM_WAIT_MS = 90_000
export const PUBLISH_POLL_MS = 2_000

/** One post a publish made, as the server named it in the 202. */
export interface MadePost {
  id: string
  status: string
  platforms: string[]
}

/** One clip's outcome from a Post now / Schedule submission. */
export interface PublishOutcome {
  clipId: string
  title: string
  ok: boolean
  /** 'submitted' | 'rendering' | 'scheduled' when ok; the refusal when not. */
  detail: string
  /** The posts the publish made, when ok and now — what progress is read from. */
  posts: MadePost[]
}

export interface PostProgress {
  postId: string
  clipId: string
  platforms: string[]
  /** Account ids, once the server's list names them; the 202 does not. */
  accountIds: string[]
  status: string
  outcome: "posting" | "posted" | "failed"
}

/** The truth per post for the posts a publish made, from the clips' recent posts. */
export function progressOf(outcomes: PublishOutcome[], postsByClip: Map<string, ClipPost[]>): PostProgress[] {
  const progress: PostProgress[] = []
  for (const outcome of outcomes) {
    if (!outcome.ok) continue
    const known = new Map((postsByClip.get(outcome.clipId) ?? []).map((post) => [post.id, post]))
    for (const made of outcome.posts) {
      const post = known.get(made.id)
      progress.push({
        postId: made.id,
        clipId: outcome.clipId,
        platforms: post ? post.targets.map((target) => target.platform) : made.platforms,
        accountIds: post ? post.targets.map((target) => target.accountId) : [],
        status: post ? post.status : made.status,
        outcome: post ? post.outcome : "posting",
      })
    }
  }
  return progress
}

/**
 * The control's word from the posts. `refused` counts clips the server
 * refused outright (no posts were made for them).
 */
export function phaseOf(progress: PostProgress[], refused: number, waitedOut: boolean): PublishPhase {
  const posting = progress.some((post) => post.outcome === "posting")
  const failed = refused > 0 || progress.some((post) => post.outcome === "failed")
  if (posting && !waitedOut) return "publishing"
  if (failed) return "failed"
  if (posting) return "sent"
  return progress.length > 0 ? "published" : "idle"
}

/**
 * What Try again sends: for a clip the server refused outright, every
 * chosen account; for a clip with a refused post, that post's accounts —
 * never an account whose post is up, which would put the clip in front of
 * its audience twice.
 */
export function retryPlans(
  outcomes: PublishOutcome[],
  posts: PostProgress[],
  chosen: Array<{ id: string; platform: string }>,
): Array<{ clipId: string; accountIds: string[] }> {
  const plans: Array<{ clipId: string; accountIds: string[] }> = []
  for (const outcome of outcomes) {
    if (!outcome.ok) {
      if (chosen.length > 0) plans.push({ clipId: outcome.clipId, accountIds: chosen.map((account) => account.id) })
      continue
    }
    const failed = posts.filter((post) => post.clipId === outcome.clipId && post.outcome === "failed")
    if (failed.length === 0) continue
    const ids = new Set<string>()
    for (const post of failed) {
      if (post.accountIds.length > 0) post.accountIds.forEach((id) => ids.add(id))
      else chosen.filter((account) => post.platforms.includes(account.platform)).forEach((account) => ids.add(account.id))
    }
    if (ids.size > 0) plans.push({ clipId: outcome.clipId, accountIds: Array.from(ids) })
  }
  return plans
}

export function usePublishProgress(
  outcomes: PublishOutcome[] | null,
  pollMs = PUBLISH_POLL_MS,
  waitMs = PUBLISH_CONFIRM_WAIT_MS,
): { phase: PublishPhase; posts: PostProgress[]; waitedOut: boolean; unreadable: boolean } {
  const [posts, setPosts] = useState<PostProgress[]>([])
  const [waitedOut, setWaitedOut] = useState(false)
  const [unreadable, setUnreadable] = useState(false)

  useEffect(() => {
    if (!outcomes) {
      setPosts([])
      setWaitedOut(false)
      setUnreadable(false)
      return
    }
    setPosts(progressOf(outcomes, new Map()))
    setWaitedOut(false)
    setUnreadable(false)
    const clipIds = Array.from(new Set(outcomes.filter((outcome) => outcome.ok && outcome.posts.length > 0).map((outcome) => outcome.clipId)))
    if (clipIds.length === 0) return

    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    const startedAt = Date.now()
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
    }
    const tick = async () => {
      try {
        const pages = await Promise.all(clipIds.map((clipId) => api.listClipPosts(clipId)))
        if (cancelled) return
        const byClip = new Map(clipIds.map((clipId, index) => [clipId, pages[index]?.posts ?? []]))
        const next = progressOf(outcomes, byClip)
        setPosts(next)
        if (next.every((post) => post.outcome !== "posting")) {
          stop()
          return
        }
      } catch (cause) {
        if (cancelled) return
        if (cause instanceof ApiError && cause.status === 404) {
          // A server that cannot be asked: the clip went; that is all that is known.
          setUnreadable(true)
          stop()
          return
        }
      }
      if (Date.now() - startedAt >= waitMs) {
        setWaitedOut(true)
        stop()
      }
    }
    void tick()
    timer = setInterval(() => void tick(), pollMs)
    return () => {
      cancelled = true
      stop()
    }
  }, [outcomes, pollMs, waitMs])

  const refused = outcomes?.filter((outcome) => !outcome.ok).length ?? 0
  const phase: PublishPhase = outcomes === null ? "idle" : phaseOf(posts, refused, waitedOut || unreadable)
  return { phase, posts, waitedOut, unreadable }
}
