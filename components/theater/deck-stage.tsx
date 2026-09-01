"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { api } from "@/lib/api"
import type { Clip, ClipMatch, ClipRequest, MatchFeedback, MatchFeedbackReason, Video } from "@/lib/types"
import { FilmLeader } from "./film-leader"
import { VerticalFrame } from "@/components/media/vertical-frame"
import {
  DeckControls,
  DeckEndState,
  KeptGrid,
  ReclipCardButton,
  RegeneratingOverlay,
  SkipPill,
  deckQueue,
  type KeptClipTile,
} from "./review-deck"
import {
  PublishDone,
  WhenTo,
  WhereTo,
  publishEach,
  type PublishOutcome,
  type PublishableClip,
} from "./publish-flow"

const EASE = [0.23, 1, 0.32, 1] as const

const SUGGESTIONS = [
  "Clip every time the energy peaks",
  "Find the part where they introduce themselves",
]

/**
 * The stage: one centered panel that walks the whole journey — the film
 * leader while the video is read, the question, the deck of moments, what
 * was kept, and publishing it now or later. The owner's screens of
 * 2026-08-30, carrying over every honesty rule the drawer held:
 *
 * - An answer given before the whole video was watched says so in the
 *   answer, and never calls a not-yet-read stretch a failure.
 * - A stretch that could NOT be looked at is named, with the exact times,
 *   because its silence is not evidence of absence.
 * - Moments seen but not trusted are listed plainly, with "look again".
 *
 * When an answer is clean and complete and has moments, no words appear at
 * all — the cards speak, per the owner's screens. Text shows up only when
 * it carries something the deck cannot: a failure, an empty result, or
 * "still watching the rest".
 *
 * The question box stays reachable under the panel the whole time —
 * whatever the person types is what gets searched, verbatim.
 */

/** One question and everything that came back for it. */
export interface StageExchange {
  request: ClipRequest
  clips: Clip[]
}

/** m:ss — the same clock the stage player writes. */
const asPlayerTime = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

/**
 * How long, said the way someone would say it out loud. Nobody reads
 * "08:12" as a length.
 */
function describeMinutes(seconds: number): string {
  if (seconds < 90) return "a minute"
  return `${Math.round(seconds / 60)} minutes`
}

/** Whole minutes and seconds, for a duration rather than a position. */
function describeDuration(seconds: number): string {
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes === 0) return `${rest}s`
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

/**
 * What the answer says, out loud. Written the way a person would say it —
 * "segment" and "examine" are ours, not the reader's.
 */
export function answerLine(request: ClipRequest, readThroughSeconds?: number | null): string {
  const count = request.matches?.length ?? 0
  if (request.status === "failed") return request.error ?? "Something went wrong with that search."

  // Answered before the whole video had been watched: said in the answer,
  // not in a warning box — the box's words ("couldn't look") would be
  // untrue of a stretch we simply had not reached yet.
  const partial = request.coverage?.gaps?.some((gap) => gap.reason === "not_read_yet") ?? false

  if (partial && count > 0) {
    const found = count === 1 ? "One so far" : `${count} so far`
    const sofar = readThroughSeconds ? ` — I'm only ${describeMinutes(readThroughSeconds)} in` : ""
    return `${found}${sofar}. Still watching the rest.`
  }

  if (count === 0) {
    // Never claim the video lacks something when part of it went unread.
    if (request.coverage?.complete === false) {
      return "I didn't find that in the parts of the video I could look at."
    }
    return request.uncertain?.length
      ? "I didn't find a clear match — but there's one I'm unsure about below."
      : "I couldn't find that. Try describing the moment a different way."
  }

  const found = count === 1 ? "Found one moment." : `Found ${count} moments.`
  return count === 1
    ? `${found} Keep it, skip it, or have me re-cut it.`
    : `${found} Keep, skip, or re-cut each one.`
}

/** Words resolve out of blur, one after another. */
function StreamedLine({ text, className }: { text: string; className?: string }) {
  const words = useMemo(() => text.split(" "), [text])
  return (
    <p className={className}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline [will-change:filter,opacity]"
          style={{ animation: `stream-in 420ms cubic-bezier(0.22,0.61,0.25,1) ${i * 48}ms both` }}
        >
          {word}{" "}
        </span>
      ))}
    </p>
  )
}

/**
 * States plainly that part of the video was never looked at. A chunk a
 * provider refused used to be invisible, and a user whose moment fell
 * inside it was told the video did not contain it.
 */
function CoverageGap({ request, onSeek }: { request: ClipRequest; onSeek: (seconds: number) => void }) {
  const coverage = request.coverage
  if (!coverage || coverage.complete) return null

  const gaps = (coverage.gaps ?? []).filter((gap) => gap.reason !== "not_read_yet")
  const degraded = coverage.degraded ?? []

  const gapLine =
    gaps.length > 0
      ? `I couldn't look at ${describeDuration(coverage.unsearchedSeconds)} of this video, so I'd have missed anything in ${gaps.length === 1 ? "it" : "those bits"}.`
      : coverage.locatable === false
        ? "There's part of this video I couldn't look at, so I may have missed something."
        : null

  if (!gapLine && degraded.length === 0) return null

  return (
    <div
      className="rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-600/30"
      style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      {gapLine && <p className="text-[13px] leading-snug text-amber-900">{gapLine}</p>}
      {gaps.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {gaps.map((gap) => (
            <button
              key={`gap-${gap.startSeconds}-${gap.endSeconds}`}
              type="button"
              onClick={() => onSeek(gap.startSeconds)}
              className="rounded-lg bg-amber-500/15 px-2 py-1 font-mono text-[11px] tabular-nums text-amber-900 transition-colors hover:bg-amber-500/25"
            >
              {gap.startTimecode} – {gap.endTimecode}
            </button>
          ))}
        </div>
      )}

      {degraded.length > 0 && (
        <div className={gapLine ? "mt-3 border-t border-amber-600/20 pt-2.5" : ""}>
          <p className="text-[13px] leading-snug text-amber-900">
            {degraded.length === 1 ? "There's a bit" : `There are ${degraded.length} bits`} where I could see the
            video but not hear it, so I'd have missed anything that was only said out loud.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {degraded.map((window) => (
              <button
                key={`degraded-${window.startSeconds}-${window.endSeconds}`}
                type="button"
                onClick={() => onSeek(window.startSeconds)}
                className="rounded-lg bg-amber-500/15 px-2 py-1 font-mono text-[11px] tabular-nums text-amber-900 transition-colors hover:bg-amber-500/25"
              >
                {window.startTimecode} – {window.endTimecode}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The moments we found and did not show. Saying "I saw something here, I'm
 * not sure" is more honest than a silent drop — a person cannot tell a
 * silent drop apart from their video genuinely not containing it.
 */
function UncertainMoments({
  request,
  onSeek,
  onLookAgain,
}: {
  request: ClipRequest
  onSeek: (seconds: number) => void
  onLookAgain: (() => void) | null
}) {
  const uncertain = request.uncertain ?? []
  if (uncertain.length === 0) return null

  return (
    <div className="rounded-xl bg-shmuted/60 px-3 py-2.5 ring-1 ring-shborder">
      <p className="text-[12.5px] leading-snug text-muted-foreground">
        {uncertain.length === 1 ? "There's one moment" : `There are ${uncertain.length} moments`} I spotted but
        wasn't sure about.
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {uncertain.map((moment) => (
          <button
            key={`${moment.startSeconds}-${moment.endSeconds}`}
            type="button"
            onClick={() => onSeek(moment.startSeconds)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-shaccent"
          >
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {moment.startTimecode}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
              {moment.description || "Something worth a look"}
            </span>
          </button>
        ))}
      </div>
      {onLookAgain && (
        <button
          type="button"
          onClick={onLookAgain}
          className="mt-1.5 rounded-lg px-1.5 py-1 text-[12px] font-medium text-amber-700 transition-colors hover:bg-shaccent hover:text-amber-800"
        >
          Look again, properly
        </button>
      )}
    </div>
  )
}

/**
 * Holds a signed URL at the first value it arrived with.
 *
 * The backend re-signs playback URLs per request and this page polls every
 * two seconds while a video is still being read, so binding a <video src>
 * to the newest one reloads the player mid-watch and throws the viewer back
 * to the start of the moment. VideoStage pins for the same reason. The
 * newest value is taken only when the pinned one actually fails.
 */
function usePinnedUrl(latest: string | null): readonly [string | null, () => void] {
  const [pinned, setPinned] = useState<string | null>(latest)
  useEffect(() => {
    // Pin the first real URL, and drop the pin if the source goes away.
    setPinned((current) => (current === null || latest === null ? latest : current))
  }, [latest])
  const refresh = useCallback(() => {
    setPinned((current) => (latest && latest !== current ? latest : current))
  }, [latest])
  return [pinned, refresh] as const
}

/**
 * Holds each match's thumbnail at the first URL it arrived with. The
 * backend signs thumbnail URLs per request, so binding src to the newest
 * one refetches every image on every poll; pin the first and move only
 * when the pinned one actually fails.
 */
function usePinnedThumbnails(matches: ClipMatch[]) {
  const latest = useMemo(() => {
    const urls: Record<string, string> = {}
    for (const match of matches) if (match.thumbnailUrl) urls[match.id] = match.thumbnailUrl
    return urls
  }, [matches])

  const [pinned, setPinned] = useState<Record<string, string>>(latest)

  useEffect(() => {
    setPinned((current) => {
      const ids = Object.keys(latest)
      let changed = ids.length !== Object.keys(current).length
      const next: Record<string, string> = {}
      for (const id of ids) {
        next[id] = current[id] ?? latest[id]!
        if (next[id] !== current[id]) changed = true
      }
      return changed ? next : current
    })
  }, [latest])

  const refresh = useCallback(
    (matchId: string) =>
      setPinned((current) => {
        const fresh = latest[matchId]
        return fresh && fresh !== current[matchId] ? { ...current, [matchId]: fresh } : current
      }),
    [latest],
  )

  return [pinned, refresh] as const
}

/**
 * The deck itself: the tall card, ↻ on its corner, ✕/✓ beneath. The moment
 * plays IN the card — full frame, letterboxed rather than cropped, because
 * a decision made on a crop is a decision about a different clip.
 */
function Deck({
  matches,
  clipByMatch,
  requestIdByMatch,
  playbackUrl,
  onSeek,
  onKeep,
  onRate,
  onReclip,
  hotkeys,
}: {
  matches: ClipMatch[]
  clipByMatch: Map<string, Clip>
  /** Which answer each moment came from — a moment outlives its answer. */
  requestIdByMatch: Map<string, string>
  playbackUrl: string | null
  onSeek: (seconds: number) => void
  onKeep: (matchId: string) => void
  onRate: (matchId: string, verdict: MatchFeedback | null, reason?: MatchFeedbackReason | null) => void
  onReclip: (matchId: string) => void
  hotkeys: boolean
}) {
  const [thumbnails, refreshThumbnail] = usePinnedThumbnails(matches)
  const [pinnedPlayback, refreshPlayback] = usePinnedUrl(playbackUrl)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  /** A decision just made: the chosen control fills for a beat before the
   *  card leaves — confirmation first, then exit. */
  const [deciding, setDeciding] = useState<{ id: string; decision: "keep" | "skip" } | null>(null)
  const [undoableId, setUndoableId] = useState<string | null>(null)

  const queue = useMemo(() => deckQueue(matches), [matches])

  useEffect(() => {
    if (!deciding) return
    const timer = setTimeout(() => setDeciding(null), 240)
    return () => clearTimeout(timer)
  }, [deciding])

  // The pill leaves on its own — unless the deck is empty, where it is the
  // only trace of the last decision and the only way to take it back.
  useEffect(() => {
    if (!undoableId || queue.length === 0) return
    const timer = setTimeout(() => setUndoableId(null), 6000)
    return () => clearTimeout(timer)
  }, [undoableId, queue.length])

  const decidingMatch = deciding ? matches.find((match) => match.id === deciding.id) : undefined
  const active = decidingMatch ?? queue[0]
  const undoable = matches.find((match) => match.id === undoableId && match.feedback === "rejected") ?? null

  const keep = (match: ClipMatch) => {
    if (deciding || match.reclipStatus === "pending") return
    onKeep(match.id)
    setUndoableId(null)
    setDeciding({ id: match.id, decision: "keep" })
    setPreviewingId(null)
  }

  const skip = (match: ClipMatch) => {
    if (deciding || match.reclipStatus === "pending") return
    onRate(match.id, "rejected")
    setUndoableId(match.id)
    setDeciding({ id: match.id, decision: "skip" })
    setPreviewingId(null)
  }

  const undoSkip = (match: ClipMatch) => {
    onRate(match.id, null)
    setUndoableId(null)
  }

  // The reference deck's keyboard: → keeps, ← skips, u/Backspace brings the
  // last skip back. Never while typing, and never from a focused player —
  // its arrow keys seek.
  useEffect(() => {
    if (!hotkeys) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (["INPUT", "TEXTAREA", "SELECT", "VIDEO", "AUDIO"].includes(target.tagName) || target.isContentEditable)
      )
        return
      if (event.key === "ArrowRight" && active) keep(active)
      else if (event.key === "ArrowLeft" && active) skip(active)
      else if ((event.key === "u" || event.key === "Backspace") && undoable) undoSkip(undoable)
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotkeys, active?.id, active?.reclipStatus, undoable?.id, deciding])

  if (!active) {
    // Every moment is decided — but the last skip must still be takeable
    // back. Returning null here unmounted this component and its undo
    // state with it, so the FINAL skip was the one skip you could not
    // undo, alone among all of them. The card is gone; the pill is not.
    if (!undoable) return null
    return (
      <div className="pb-4" data-testid="deck-undo-only">
        <SkipPill
          match={undoable}
          onUndo={() => undoSkip(undoable)}
          onReason={(reason) => onRate(undoable.id, "rejected", reason)}
          onReclipInstead={() => {
            onRate(undoable.id, null)
            setUndoableId(null)
            onReclip(undoable.id)
          }}
        />
      </div>
    )
  }

  const activeThumbnail = thumbnails[active.id] ?? null
  const clip = clipByMatch.get(active.id) ?? null
  const playable = clip?.status === "ready" && clip?.url ? clip.url : null
  const regenerating = active.reclipStatus === "pending"
  /** The cards waiting behind, fanned either side — the owner's stack. */
  const behind = queue.slice(1, 5)

  return (
    <div data-testid="deck">
      <h2 className="pb-6 text-center text-[28px] font-semibold tracking-tight">Keep this moment?</h2>

      {/* The stack. Neighbours are pure depth — dimmed, inert, and hidden
          from assistive tech; only the front card is a decision. */}
      <div className="relative flex items-center justify-center">
        {behind.map((peer, index) => {
          const side = index % 2 === 0 ? 1 : -1
          const rank = Math.floor(index / 2) + 1
          const peerThumb = thumbnails[peer.id] ?? null
          return (
            <VerticalFrame
              key={peer.id}
              isVertical
              className="pointer-events-none absolute w-[48%] overflow-hidden rounded-[24px] bg-[#101013]"
              style={{
                transform: `translateX(${side * rank * 30}%) scale(${1 - rank * 0.09})`,
                zIndex: 10 - rank,
                filter: `brightness(${0.55 - rank * 0.14})`,
              }}
            >
              {peerThumb ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={peerThumb} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="block h-full w-full" />
              )}
            </VerticalFrame>
          )
        })}

        <VerticalFrame
          isVertical
          className="relative z-20 w-[58%] overflow-hidden rounded-[26px] bg-[#101013] shadow-[0_18px_50px_rgba(17,17,22,0.22)]"
          style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}
        >
          <ReclipCardButton
            pending={regenerating}
            remaining={active.reclipsRemaining ?? 0}
            onReclip={() => onReclip(active.id)}
          />
          {regenerating && <RegeneratingOverlay />}

          {/* The moment, watchable here: still → in-place preview cued from
              the source stream → the finished cut once it exists. */}
          {!playable && previewingId !== active.id && (
            <button
              type="button"
              onClick={() => (pinnedPlayback ? setPreviewingId(active.id) : onSeek(active.startSeconds))}
              className="group/still relative block h-full w-full"
              aria-label={`Play this moment (${asPlayerTime(active.startSeconds)} to ${asPlayerTime(active.endSeconds)})`}
            >
              {activeThumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activeThumbnail}
                  alt=""
                  onError={() => refreshThumbnail(active.id)}
                  className="h-full w-full object-cover"
                  style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
                />
              ) : (
                <span className="block h-full w-full bg-gradient-to-b from-white/10 to-transparent" />
              )}
              <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white opacity-0 ring-1 ring-white/30 transition-opacity group-hover/still:opacity-100">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
                </svg>
              </span>
            </button>
          )}

          {!playable && previewingId === active.id && pinnedPlayback && (
            <video
              src={pinnedPlayback ?? undefined}
              autoPlay
              controls
              playsInline
              // A signature can expire mid-session; only then take the
              // newest one, and never on the two-second poll cadence.
              onError={refreshPlayback}
              onLoadedMetadata={(event) => {
                event.currentTarget.currentTime = active.startSeconds
              }}
              onPlay={(event) => {
                const element = event.currentTarget
                // One soundtrack at a time.
                for (const other of document.querySelectorAll("video")) {
                  if (other !== element) other.pause()
                }
                if (element.currentTime >= active.endSeconds - 0.05) {
                  element.currentTime = active.startSeconds
                }
              }}
              onTimeUpdate={(event) => {
                // The preview is the MOMENT, not the film: stop at its end.
                if (event.currentTarget.currentTime >= active.endSeconds) event.currentTarget.pause()
              }}
              className="h-full w-full bg-black object-contain"
            />
          )}

          {playable && (
            <video
              src={playable}
              controls
              preload="metadata"
              playsInline
              className="h-full w-full bg-black object-contain"
              style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
            />
          )}
        </VerticalFrame>

        {/* The take-back, floating over the stack and leaving on its own. */}
        <AnimatePresence>
          {undoable && (
            <motion.div
              key="skip-pill"
              className="pointer-events-none absolute inset-x-[20%] top-3 z-30"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <SkipPill
                match={undoable}
                onUndo={() => undoSkip(undoable)}
                onReason={(reason) => onRate(undoable.id, "rejected", reason)}
                onReclipInstead={() => {
                  onRate(undoable.id, null)
                  setUndoableId(null)
                  onReclip(undoable.id)
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-7">
        <DeckControls
          onSkip={() => skip(active)}
          onKeep={() => keep(active)}
          disabled={regenerating}
          deciding={deciding?.id === active.id ? deciding.decision : null}
        />
      </div>

      {/* One reserved line for status, so a failure appearing cannot resize
          the panel under the person's cursor. */}
      <p className="mt-2 h-4 truncate text-center text-[11.5px] text-amber-700" data-testid="deck-status">
        {active.reclipStatus === "failed" ? (active.reclipError ?? "Re-clip didn't work. The original is untouched — try again.") : ""}
      </p>
    </div>
  )
}

// --- The stage ------------------------------------------------------------

type PanelStage = "flow" | "publish" | "when" | "done"

export function DeckStage({
  video,
  exchanges,
  busy,
  onSearch,
  onSeek,
  onKeep,
  onRate,
  onReclip,
  onUploadMore,
  uploadFraction,
}: {
  video: Video
  exchanges: StageExchange[]
  busy: boolean
  onSearch: (instruction: string) => void
  onSeek: (seconds: number) => void
  /** Keep: persist the verdict AND queue the cut, as one coordinated act. */
  onKeep: (requestId: string, matchId: string) => void
  onRate: (requestId: string, matchId: string, verdict: MatchFeedback | null, reason?: MatchFeedbackReason | null) => void
  /** Ask the system to re-evaluate this SAME moment and cut it better. */
  onReclip: (requestId: string, matchId: string) => void
  /** Back to the empty upload state — what "home" and "upload more" mean. */
  onUploadMore: () => void
  /** 0..1 while this video's bytes are still going up; null after. */
  uploadFraction: number | null
}) {
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [stage, setStage] = useState<PanelStage>("flow")
  /** The account/caption choice carried from Where → When → retry. */
  const [publishChoice, setPublishChoice] = useState<{ accountIds: string[]; caption: string } | null>(null)
  const [publishBusy, setPublishBusy] = useState(false)
  const [outcomes, setOutcomes] = useState<PublishOutcome[]>([])
  const [publishMode, setPublishMode] = useState<"now" | "scheduled">("now")
  /** One clip id when publishing a single tile; null means everything ready. */
  const [publishOnly, setPublishOnly] = useState<string | null>(null)
  const [publishWhen, setPublishWhen] = useState<Date | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  /** Session-local names and removals for kept tiles; the server holds the truth for the library. */
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>({})
  const [removedClipIds, setRemovedClipIds] = useState<Set<string>>(new Set())
  const [tileError, setTileError] = useState<string | null>(null)

  const current = exchanges.at(-1) ?? null
  const searching = current?.request.status === "pending" || current?.request.status === "searching"
  const understanding =
    video.index?.status === "pending" || video.index?.status === "queued" || video.index?.status === "running"
  const canSend = draft.trim().length > 0 && video.readyForSearch && !busy && !searching

  const submit = () => {
    const instruction = draft.trim()
    // Enter goes through here, not through the button, so the button's
    // gate has to be repeated: nothing sends until the video can be searched.
    if (!instruction || busy || searching || !video.readyForSearch) return
    setDraft("")
    onSearch(instruction)
  }

  /**
   * Every moment this video has produced, across every question asked of
   * it — newest answer first.
   *
   * Deliberately NOT just the newest answer. Asking a second question while
   * moments from the first are still undecided used to strand them: the
   * deck switched wholesale and there was no way back to them. A moment is
   * undecided until someone decides it, whichever question found it.
   */
  const { matches, clipByMatch, requestIdByMatch } = useMemo(() => {
    const collected: ClipMatch[] = []
    const clips = new Map<string, Clip>()
    const owners = new Map<string, string>()
    // Newest first, so the freshest answer's moments lead the queue.
    for (const exchange of [...exchanges].reverse()) {
      if (exchange.request.status !== "completed") continue
      for (const match of exchange.request.matches ?? []) {
        collected.push(match)
        owners.set(match.id, exchange.request.id)
      }
      for (const clip of exchange.clips) clips.set(clip.clipMatchId, clip)
    }
    return { matches: collected, clipByMatch: clips, requestIdByMatch: owners }
  }, [exchanges])

  const queue = useMemo(() => deckQueue(matches), [matches])

  /**
   * Everything kept this session, across every question asked of this
   * video — assembled with each tile's true state.
   */
  const keptTiles: KeptClipTile[] = useMemo(() => {
    const tiles: KeptClipTile[] = []
    for (const exchange of exchanges) {
      const clipsByMatchId = new Map(exchange.clips.map((clip) => [clip.clipMatchId, clip]))
      for (const match of exchange.request.matches ?? []) {
        if (match.feedback !== "approved") continue
        const clip = clipsByMatchId.get(match.id) ?? null
        const id = clip?.id ?? match.id
        if (removedClipIds.has(id)) continue
        const durationSeconds = clip?.durationSeconds ?? match.durationSeconds
        tiles.push({
          id,
          title: titleOverrides[id] ?? match.description ?? "Kept moment",
          videoTitle: video.title ?? video.originalFilename ?? null,
          duration: durationSeconds != null ? asPlayerTime(durationSeconds) : null,
          url: clip?.status === "ready" ? (clip.url ?? null) : null,
          poster: match.thumbnailUrl ?? null,
          status:
            clip == null || clip.status === "pending" || clip.status === "generating"
              ? "cutting"
              : clip.status === "failed"
                ? "failed"
                : "ready",
          error: clip?.status === "failed" ? (clip.error ?? null) : null,
        })
      }
    }
    return tiles
  }, [exchanges, titleOverrides, removedClipIds, video.title, video.originalFilename])

  const publishable: PublishableClip[] = useMemo(
    () => keptTiles.map((tile) => ({ id: tile.id, title: tile.title, ready: tile.status === "ready" && tile.url != null })),
    [keptTiles],
  )

  const renameTile = useCallback((id: string, title: string) => {
    setTileError(null)
    // Paint first; the library will show the same name once the server has
    // it. A refusal puts the old name back and says why.
    setTitleOverrides((current) => ({ ...current, [id]: title }))
    api.renameClip(id, title).catch((cause) => {
      setTitleOverrides((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      setTileError(cause instanceof Error ? cause.message : "Couldn't rename that clip.")
    })
  }, [])

  const deleteTile = useCallback((id: string) => {
    setTileError(null)
    if (!window.confirm("Delete this clip? This can't be undone.")) return
    setRemovedClipIds((current) => new Set(current).add(id))
    api.deleteClip(id).catch((cause) => {
      setRemovedClipIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      setTileError(cause instanceof Error ? cause.message : "Couldn't delete that clip.")
    })
  }, [])

  const readyClips = publishable.filter(
    (clip) => clip.ready && (publishOnly === null || clip.id === publishOnly),
  )

  const postNow = useCallback(
    async (accountIds: string[], caption: string) => {
      setPublishBusy(true)
      setPublishChoice({ accountIds, caption })
      const results = await publishEach(readyClips, { caption, accountIds })
      setOutcomes(results)
      setPublishMode("now")
      setPublishWhen(null)
      setPublishBusy(false)
      setStage("done")
    },
    [readyClips],
  )

  const commitSchedule = useCallback(
    async (when: Date) => {
      if (!publishChoice) return
      setPublishBusy(true)
      setScheduleError(null)
      const results = await publishEach(readyClips, {
        caption: publishChoice.caption,
        accountIds: publishChoice.accountIds,
        scheduledAt: when.toISOString(),
      })
      setPublishBusy(false)
      if (results.every((result) => !result.ok) && results.length > 0) {
        // Nothing was accepted: stay here and show the first reason in
        // place, so the fix (usually the time) is one tap away.
        setScheduleError(results[0]!.detail)
        return
      }
      setOutcomes(results)
      setPublishMode("scheduled")
      setPublishWhen(when)
      setStage("done")
    },
    [publishChoice, readyClips],
  )

  const retryFailed = useCallback(async () => {
    const failedIds = new Set(outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.clipId))
    const again = readyClips.filter((clip) => failedIds.has(clip.id))
    if (again.length === 0 || !publishChoice) return
    setPublishBusy(true)
    const results = await publishEach(again, {
      caption: publishChoice.caption,
      accountIds: publishChoice.accountIds,
      ...(publishMode === "scheduled" && publishWhen ? { scheduledAt: publishWhen.toISOString() } : {}),
    })
    setOutcomes((current) => {
      const byId = new Map(results.map((result) => [result.clipId, result]))
      return current.map((outcome) => byId.get(outcome.clipId) ?? outcome)
    })
    setPublishBusy(false)
  }, [outcomes, readyClips, publishChoice, publishMode, publishWhen])

  // --- What the panel shows -----------------------------------------------

  const leader = !video.readyForSearch
  /** The deck is done and there are keeps: the grid becomes the whole view,
   *  at the library's full width rather than in a narrow column. */
  const keptOnly =
    !searching && queue.length === 0 && current != null && matches.length > 0 && keptTiles.length > 0
  const showAskIdle = !leader && exchanges.length === 0

  return (
    <section className="w-full" aria-label="Review your moments" data-testid="deck-stage">
      {/* No panel around any of this — the owner's call (2026-08-30). The
          deck and the publish steps hold a centred column so a decision
          stays in one place; the kept clips run the library's full grid
          width, because they ARE the library's cards. */}
      <div className={stage === "flow" && !leader && keptOnly ? "w-full" : "mx-auto w-full max-w-[34rem]"}>
        {stage === "publish" ? (
          <WhereTo
            clips={publishable}
            busy={publishBusy}
            onBack={() => {
              setPublishOnly(null)
              setStage("flow")
            }}
            onPostNow={(accountIds, caption) => void postNow(accountIds, caption)}
            onSchedule={(accountIds, caption) => {
              setPublishChoice({ accountIds, caption })
              setScheduleError(null)
              setStage("when")
            }}
          />
        ) : stage === "when" ? (
          <WhenTo
            busy={publishBusy}
            error={scheduleError}
            clipCount={readyClips.length}
            onBack={() => setStage("publish")}
            onCommit={(when) => void commitSchedule(when)}
          />
        ) : stage === "done" ? (
          <PublishDone
            mode={publishMode}
            when={publishWhen}
            outcomes={outcomes}
            busy={publishBusy}
            onRetryFailed={outcomes.some((outcome) => !outcome.ok) ? () => void retryFailed() : null}
            onHome={onUploadMore}
          />
        ) : leader ? (
          <div>
            <div className="overflow-hidden rounded-2xl">
              <VerticalFrame isVertical>
                <FilmLeader className="h-full w-full" />
              </VerticalFrame>
            </div>
            <p className="mt-3 h-5 text-center text-[13px] text-muted-foreground" style={{ animation: "pulse-soft 2.2s ease-in-out infinite" }}>
              {uploadFraction !== null
                ? `Uploading — ${Math.round(uploadFraction * 100)}%`
                : video.status === "failed"
                  ? (video.error ?? "This video couldn't be processed.")
                  : "Reading your video — questions open the moment it's done"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {showAskIdle && (
              <div className="py-2">
                <h2 className="text-xl font-semibold tracking-tight">What should I find?</h2>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  {understanding
                    ? video.index?.readThroughSeconds
                      ? `Still watching — ${describeMinutes(video.index.readThroughSeconds)} in so far. Ask away, and I'll answer from what I've seen.`
                      : "Still watching this video. Ask away — I'll answer as soon as I've seen enough."
                    : "Describe the moment in your own words — whatever you type is what gets searched."}
                </p>
                <div className="mt-3 flex flex-col">
                  {SUGGESTIONS.map((text, i) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => {
                        setDraft(text)
                        inputRef.current?.focus()
                      }}
                      className="-mx-1.5 flex items-center gap-2 rounded-lg border-b border-shborder px-1.5 py-2.5 text-left text-[13.5px] transition-colors hover:bg-shaccent"
                      style={{ animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${i * 90}ms both` }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground/60" aria-hidden>
                        <path d="M9 10l-5 5 5 5" />
                        <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                      </svg>
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {current && (
              <div className="flex flex-col gap-2.5">
                {/* Words only when they carry something the deck cannot
                    show itself: the search failed, nothing matched, or the
                    video is still being read and more may come. A clean
                    answer with moments says nothing — the cards speak. */}
                {searching ? (
                  <p className="text-sm text-muted-foreground" style={{ animation: "pulse-soft 1.8s ease-in-out infinite" }}>
                    {understanding
                      ? "Still taking notes on this video — I'll answer the moment I've seen enough."
                      : "Looking through what I know about this video…"}
                  </p>
                ) : current.request.status === "failed" ||
                  matches.length === 0 ||
                  (current.request.coverage?.gaps?.some((gap) => gap.reason === "not_read_yet") ?? false) ? (
                  <StreamedLine
                    key={current.request.id + current.request.status}
                    text={answerLine(current.request, video.index?.readThroughSeconds ?? null)}
                    className={`text-sm leading-relaxed ${current.request.status === "failed" ? "text-destructive" : ""}`}
                  />
                ) : null}
                {!searching && <CoverageGap request={current.request} onSeek={onSeek} />}
                {!searching && (
                  <UncertainMoments
                    request={current.request}
                    onSeek={onSeek}
                    onLookAgain={!busy && !searching && video.readyForSearch ? () => onSearch("look again") : null}
                  />
                )}
              </div>
            )}

            {searching && (
              <VerticalFrame isVertical>
                <div className="h-full w-full animate-pulse rounded-2xl bg-shmuted" aria-hidden />
              </VerticalFrame>
            )}

            {/* The deck stays mounted while ANY moment exists, even with an
                empty queue: the last skip's take-back lives inside it, and
                unmounting on the final decision would swallow the one undo
                that matters most. A moment carries its own answer's id, so
                deciding still lands on the right request. */}
            {!searching && matches.length > 0 && (
              <Deck
                matches={matches}
                clipByMatch={clipByMatch}
                requestIdByMatch={requestIdByMatch}
                playbackUrl={video.playback?.url ?? null}
                onSeek={onSeek}
                onKeep={(matchId) => {
                  const requestId = requestIdByMatch.get(matchId)
                  if (requestId) onKeep(requestId, matchId)
                }}
                onRate={(matchId, verdict, reason) => {
                  const requestId = requestIdByMatch.get(matchId)
                  if (requestId) onRate(requestId, matchId, verdict, reason)
                }}
                onReclip={(matchId) => {
                  const requestId = requestIdByMatch.get(matchId)
                  if (requestId) onReclip(requestId, matchId)
                }}
                hotkeys={stage === "flow"}
              />
            )}

            {/* The deck ran out (or the answer had no deck): what remains is
                the outcome — the kept grid when there is one, the honest
                fork when there is not. */}
            {!searching && queue.length === 0 && matches.length > 0 && (
              <div style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}>
                {keptTiles.length > 0 ? (
                  <KeptGrid
                    clips={keptTiles}
                    onReview={() => {
                      setPublishOnly(null)
                      setStage("publish")
                    }}
                    onPublish={(id) => {
                      setPublishOnly(id)
                      setStage("publish")
                    }}
                    onRename={renameTile}
                    onDelete={deleteTile}
                  />
                ) : (
                  <DeckEndState kept={0} total={matches.length} onUploadMore={onUploadMore} />
                )}
              </div>
            )}

            {/* Kept clips stay reachable while the deck is still going. */}
            {!searching && queue.length > 0 && keptTiles.length > 0 && (
              <details className="pt-1">
                <summary className="cursor-pointer text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                  {keptTiles.length} kept so far
                </summary>
                <div className="pt-4">
                  <KeptGrid
                    clips={keptTiles}
                    onReview={() => {
                      setPublishOnly(null)
                      setStage("publish")
                    }}
                    onPublish={(id) => {
                      setPublishOnly(id)
                      setStage("publish")
                    }}
                    onRename={renameTile}
                    onDelete={deleteTile}
                  />
                </div>
              </details>
            )}

            {/* One reserved line for tile trouble (rename/delete refusals). */}
            <p className="h-4 text-center text-[11.5px] text-destructive">{tileError ?? ""}</p>
          </div>
        )}
      </div>

      {/* The question box, under the panel: the owner's pill — a camera
          mark for what is being asked of, the instruction, and one send.
          Always reachable while the video can be searched, because asking
          is the product; hidden only inside the publish steps, where the
          panel is a form. */}
      {stage === "flow" && !leader && (
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div
            role="presentation"
            onClick={() => inputRef.current?.focus()}
            className="flex cursor-text items-center gap-3 rounded-full bg-shcard py-2 pl-4 pr-2 ring-1 ring-shborder transition-[box-shadow] duration-150 focus-within:ring-2 focus-within:ring-shprimary"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-foreground" aria-hidden>
              <rect x="2" y="6" width="13" height="12" rx="3" />
              <path d="M15 10.5l6-3.5v10l-6-3.5" />
            </svg>
            <span aria-hidden className="h-6 w-px shrink-0 bg-shborder" />
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  submit()
                }
              }}
              rows={1}
              placeholder={exchanges.length === 0 ? "What should I find in this video?" : "Ask for another moment"}
              className="max-h-28 min-h-[2.25rem] w-full resize-none self-center bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="Find this moment"
              disabled={!canSend}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.96] ${
                canSend ? "bg-shprimary text-primary-foreground" : "bg-shmuted text-muted-foreground"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2.5l1.9 5.1 5.1 1.9-5.1 1.9L12 16.5l-1.9-5.1L5 9.5l5.1-1.9L12 2.5Z" />
                <path d="M18.5 14.5l.85 2.15 2.15.85-2.15.85-.85 2.15-.85-2.15-2.15-.85 2.15-.85.85-2.15Z" />
              </svg>
            </button>
          </div>
        </form>
      )}
      {!video.readyForSearch && (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          Your video is still being prepared — you can type now, then send once it&apos;s ready.
        </p>
      )}
    </section>
  )
}
