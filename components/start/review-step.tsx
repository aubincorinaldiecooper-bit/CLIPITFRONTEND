"use client"

import { useMemo, useState } from "react"
import type { Video } from "@/lib/types"
import { Dialogue } from "./dialogue"
import { MomentFeed, feedCursor, feedMoments, type FeedMoment } from "./moment-feed"
import type { Exchange } from "./types"

export interface ReviewStepProps {
  /** Every question asked of this video so far, oldest first. */
  exchanges: Exchange[]
  video: Video | null
  busy?: boolean
  /** A search is running; the feed keeps working while the dialogue waits for it. */
  searching: boolean
  /** The publish dialog is open over the page: the feed decides nothing until it closes. */
  publishing?: boolean
  /** Keeps the moment and starts its file. Resolves to nothing useful here; the page shows a refusal. */
  onKeep: (requestId: string, matchId: string) => unknown
  onSkip: (requestId: string, matchId: string) => void | Promise<void>
  onUndoSkip: (requestId: string, matchId: string) => void | Promise<void>
  /** Resolves false when the re-cut did not start (the page has shown why). */
  onReclip: (requestId: string, matchId: string) => boolean | void | Promise<boolean | void>
  /** Resolves false when the question could not be sent (the page has shown why). */
  onAsk: (instruction: string) => boolean | void | Promise<boolean | void>
  /** Keep the moment and open publishing for its clip. */
  onPublish: (requestId: string, matchId: string) => void | Promise<void>
  onUploadMore: () => void
}

/**
 * Step 03: the moments, reviewed one at a time in a vertical feed, with the
 * dialogue beside it — the owner's screen of 2026-09-02. Both halves read
 * the same list: every moment of every question, in order.
 */
export function ReviewStep({ exchanges, video, busy, searching, publishing = false, onKeep, onSkip, onUndoSkip, onReclip, onAsk, onPublish, onUploadMore }: ReviewStepProps) {
  const moments = useMemo(() => feedMoments(exchanges, video), [exchanges, video])
  // The card in front, as the feed reports it: what "this one" means in the
  // dialogue. Kept moments stay in the feed to be looked at again, so the
  // front card is a position the person moves, not the first open decision.
  const [front, setFront] = useState<number | null>(null)
  const active: FeedMoment | undefined = moments[front ?? feedCursor(moments)]

  return (
    // Narrow padding on a phone: the card keeps its width there, and the
    // counter beside it needs the room the padding would have taken.
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-wrap justify-center gap-12 px-3 py-8 sm:px-6" data-testid="review-step">
      <MomentFeed
        moments={moments}
        busy={busy}
        paused={publishing}
        searching={searching}
        onFrontChange={setFront}
        onKeep={(moment) => void onKeep(moment.requestId, moment.match.id)}
        onSkip={(moment) => void onSkip(moment.requestId, moment.match.id)}
        onUndoSkip={(moment) => void onUndoSkip(moment.requestId, moment.match.id)}
        onPublish={(moment) => void onPublish(moment.requestId, moment.match.id)}
        onUploadMore={onUploadMore}
      />
      <Dialogue
        exchanges={exchanges}
        video={video}
        moments={moments}
        active={active}
        searching={searching}
        onAsk={onAsk}
        onReclip={(moment) => onReclip(moment.requestId, moment.match.id)}
      />
    </div>
  )
}
