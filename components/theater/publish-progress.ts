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
 * nobody confirmed. An older server that cannot be asked, or one that
 * accepted the clip without naming a post to ask about, reads as Sent at
 * once, for the same reason.
 *
 * The asking is bounded on every side (Devin's and Codex's findings on
 * #77): one ask at a time, each given up after PUBLISH_ASK_TIMEOUT_MS, and
 * the deadline checked before an ask rather than after — a server that
 * holds a request open must not hold the control on Uploading.
 */

export type PublishPhase = "idle" | "publishing" | "published" | "sent" | "failed"

/** How long the control waits for the platforms' word before it settles for Sent. */
export const PUBLISH_CONFIRM_WAIT_MS = 90_000
export const PUBLISH_POLL_MS = 2_000
/** How long one ask of the server may take before it is given up and asked again. */
export const PUBLISH_ASK_TIMEOUT_MS = 8_000

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
  /** Whether the LATEST submission for this clip was accepted. */
  ok: boolean
  /** 'submitted' | 'rendering' | 'scheduled' when ok; the refusal when not. */
  detail: string
  /**
   * The posts made for this clip — what progress is read from. After a
   * retry these are the earlier posts that were not refused plus the
   * retry's, so a channel that is up stays up beside a refusal.
   */
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
    // Every outcome's posts, whatever its latest submission came to: after
    // a retry a clip can carry posts that are up beside a refusal.
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

export interface PhaseCounts {
  /** Clips whose latest submission the server refused outright. */
  refused: number
  /** Clips the server accepted without naming a post to ask about: they went, and that is all that is known. */
  blind: number
}

export function countsOf(outcomes: PublishOutcome[]): PhaseCounts {
  return {
    refused: outcomes.filter((outcome) => !outcome.ok).length,
    blind: outcomes.filter((outcome) => outcome.ok && outcome.detail !== "scheduled" && outcome.posts.length === 0).length,
  }
}

/** The control's word from the posts. */
export function phaseOf(progress: PostProgress[], counts: PhaseCounts, waitedOut: boolean): PublishPhase {
  const posting = progress.some((post) => post.outcome === "posting")
  const failed = counts.refused > 0 || progress.some((post) => post.outcome === "failed")
  if (posting && !waitedOut) return "publishing"
  if (failed) return "failed"
  if (posting || counts.blind > 0) return "sent"
  return progress.length > 0 ? "published" : "idle"
}

/** Whether a post that is up carries this account's channel. */
function isUp(account: { id: string; platform: string }, clipId: string, posts: PostProgress[]): boolean {
  return posts.some(
    (post) =>
      post.clipId === clipId &&
      post.outcome === "posted" &&
      (post.accountIds.length > 0 ? post.accountIds.includes(account.id) : post.platforms.includes(account.platform)),
  )
}

/**
 * What Try again sends: for a clip whose latest submission was refused,
 * every chosen account whose channel is not already up; for a clip with a
 * refused post, that post's accounts — never an account whose post is up,
 * which would put the clip in front of its audience twice.
 */
export function retryPlans(
  outcomes: PublishOutcome[],
  posts: PostProgress[],
  chosen: Array<{ id: string; platform: string }>,
): Array<{ clipId: string; accountIds: string[] }> {
  const plans: Array<{ clipId: string; accountIds: string[] }> = []
  for (const outcome of outcomes) {
    if (!outcome.ok) {
      const ids = chosen.filter((account) => !isUp(account, outcome.clipId, posts)).map((account) => account.id)
      if (ids.length > 0) plans.push({ clipId: outcome.clipId, accountIds: ids })
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

/**
 * A retry's answer folded into what came before: the earlier posts that
 * were not refused stay (up, or still on their way), the retry's posts
 * join them, and the retry's own word says whether it was accepted.
 */
export function mergeOutcome(prior: PublishOutcome, again: PublishOutcome, posts: PostProgress[]): PublishOutcome {
  const refused = new Set(posts.filter((post) => post.clipId === prior.clipId && post.outcome === "failed").map((post) => post.postId))
  const kept = prior.posts.filter((post) => !refused.has(post.id))
  return { ...again, posts: [...kept, ...again.posts] }
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
    const clipIds = Array.from(new Set(outcomes.filter((outcome) => outcome.posts.length > 0).map((outcome) => outcome.clipId)))
    if (clipIds.length === 0) return

    let cancelled = false
    let asking = false
    let timer: ReturnType<typeof setInterval> | null = null
    const startedAt = Date.now()
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
    }
    const tick = async () => {
      // The deadline first, and never behind a request.
      if (Date.now() - startedAt >= waitMs) {
        setWaitedOut(true)
        stop()
        return
      }
      // One ask at a time; a slow one is not joined by the next tick's.
      if (asking) return
      asking = true
      try {
        const pages = await Promise.all(clipIds.map((clipId) => api.listClipPosts(clipId, PUBLISH_ASK_TIMEOUT_MS)))
        if (cancelled) return
        const byClip = new Map(clipIds.map((clipId, index) => [clipId, pages[index]?.posts ?? []]))
        const next = progressOf(outcomes, byClip)
        setPosts(next)
        if (next.every((post) => post.outcome !== "posting")) stop()
      } catch (cause) {
        if (cancelled) return
        if (cause instanceof ApiError && cause.status === 404) {
          // A server that cannot be asked: the clip went; that is all that is known.
          setUnreadable(true)
          stop()
        }
        // Anything else — a timeout, a dropped connection — is asked again next tick.
      } finally {
        asking = false
      }
    }
    void tick()
    timer = setInterval(() => void tick(), pollMs)
    return () => {
      cancelled = true
      stop()
    }
  }, [outcomes, pollMs, waitMs])

  const phase: PublishPhase = outcomes === null ? "idle" : phaseOf(posts, countsOf(outcomes), waitedOut || unreadable)
  return { phase, posts, waitedOut, unreadable }
}
