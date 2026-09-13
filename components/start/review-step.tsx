"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import type { ChatSignal, Video } from "@/lib/types"
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
  /** Moments whose Keep is being written; their cards' Keep waits. */
  keeping?: ReadonlySet<string>
  /** The moment in front, whenever it changes — what a report from this page is about. */
  onFrontMomentChange?: (moment: FeedMoment | undefined) => void
  /** Keeps the moment and starts its file. Resolves to nothing useful here; the page shows a refusal. */
  onKeep: (requestId: string, matchId: string) => unknown
  onSkip: (requestId: string, matchId: string) => void | Promise<void>
  onUndoSkip: (requestId: string, matchId: string) => void | Promise<void>
  /** Resolves false when the re-cut did not start (the page has shown why). */
  onReclip: (requestId: string, matchId: string) => boolean | void | Promise<boolean | void>
  /** Resolves false when the question could not be sent (the page has shown why). */
  onAsk: (instruction: string) => boolean | void | Promise<boolean | void>
  /** Records what someone thought of an answer. Rejecting means it was not stored. */
  onRateAnswer?: (requestId: string, event: ChatSignal) => Promise<unknown>
  /** Keep the moment and open publishing for its clip. */
  onPublish: (requestId: string, matchId: string) => void | Promise<void>
  onUploadMore: () => void
}

const ENTER_EASE = [0.22, 1, 0.36, 1] as const

/**
 * The conversational review surface. The first question moves here directly
 * from the empty composer; the two columns arrive as one restrained handoff
 * rather than a separate loading screen. MotionConfig at the app root turns
 * these transforms off for people who prefer reduced motion.
 */
export function ReviewStep({
  exchanges,
  video,
  busy,
  searching,
  publishing = false,
  keeping,
  onFrontMomentChange,
  onKeep,
  onSkip,
  onUndoSkip,
  onReclip,
  onAsk,
  onRateAnswer,
  onPublish,
  onUploadMore,
}: ReviewStepProps) {
  const moments = useMemo(() => feedMoments(exchanges, video), [exchanges, video])
  const [front, setFront] = useState<number | null>(null)
  const active: FeedMoment | undefined = moments[front ?? feedCursor(moments)]
  useEffect(() => {
    onFrontMomentChange?.(active)
    return () => onFrontMomentChange?.(undefined)
  }, [active, onFrontMomentChange])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: ENTER_EASE }}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-wrap justify-center gap-12 px-3 py-8 sm:px-6"
      data-testid="review-step"
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, delay: 0.03, ease: ENTER_EASE }}
      >
        <MomentFeed
          moments={moments}
          busy={busy}
          paused={publishing}
          searching={searching}
          keeping={keeping}
          onFrontChange={setFront}
          onKeep={(moment) => void onKeep(moment.requestId, moment.match.id)}
          onSkip={(moment) => void onSkip(moment.requestId, moment.match.id)}
          onUndoSkip={(moment) => void onUndoSkip(moment.requestId, moment.match.id)}
          onPublish={(moment) => void onPublish(moment.requestId, moment.match.id)}
          onUploadMore={onUploadMore}
        />
      </motion.div>
      <motion.div
        className="flex min-w-0 flex-1"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.07, ease: ENTER_EASE }}
      >
        <Dialogue
          exchanges={exchanges}
          video={video}
          moments={moments}
          active={active}
          searching={searching}
          onAsk={onAsk}
          onReclip={(moment) => onReclip(moment.requestId, moment.match.id)}
          onRateAnswer={onRateAnswer}
        />
      </motion.div>
    </motion.div>
  )
}
