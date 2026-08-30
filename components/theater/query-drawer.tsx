"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Clip, ClipMatch, ClipRequest, MatchFeedback, MatchFeedbackReason, Video } from "@/lib/types"
import { DeckControls, DeckEndState, ReclipCardButton, RegeneratingOverlay, SkipPill, deckQueue } from "./review-deck"

const EASE = [0.23, 1, 0.32, 1] as const

const SUGGESTIONS = [
  "Clip every time the energy peaks",
  "Find the part where they introduce themselves",
]

/** m:ss — the same clock the stage player writes. */
const asPlayerTime = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

const SOURCE_LABEL: Record<ClipMatch["source"], string> = {
  visual: "seen",
  transcript: "spoken",
  multimodal: "seen + spoken",
}

/** Words resolve out of blur, one after another — the reference stream effect. */
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
 * What the answer says, out loud.
 *
 * Written the way a person would say it. Words like "segment" and "examine"
 * are ours, not the reader's — they describe how we chopped their file up, and
 * nobody uploading a video thinks in them.
 */
/**
 * How long, said the way someone would say it out loud.
 *
 * Nobody reads "08:12" as a length. Timecodes are for pointing at a position
 * in the video, which is what the moment list uses them for; a sentence about
 * how much has been watched wants "8 minutes".
 */
function describeMinutes(seconds: number): string {
  if (seconds < 90) return "a minute"
  return `${Math.round(seconds / 60)} minutes`
}

function answerLine(request: ClipRequest, readThroughSeconds?: number | null): string {
  const count = request.matches?.length ?? 0
  if (request.status === "failed") return request.error ?? "Something went wrong with that search."

  /**
   * Answered before the whole video had been watched.
   *
   * This belongs in the answer, not in a warning box beside it. The warning
   * box exists for stretches we could not look at, and its words say exactly
   * that — which would be untrue here, where we simply had not got there yet
   * and will have in a minute. Same words, opposite meanings.
   */
  const partial = request.coverage?.gaps?.some((gap) => gap.reason === "not_read_yet") ?? false

  if (partial && count > 0) {
    const found = count === 1 ? "One so far" : `${count} so far`
    const sofar = readThroughSeconds ? ` — I'm only ${describeMinutes(readThroughSeconds)} in` : ""
    return `${found}${sofar}. Still watching the rest.`
  }

  if (count === 0) {
    // Never claim the video lacks something when part of it went unread. The
    // stretch itself is shown separately; this only keeps the sentence from
    // asserting an absence it cannot vouch for.
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

/** Whole minutes and seconds, for a duration rather than a position. */
function describeDuration(seconds: number): string {
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes === 0) return `${rest}s`
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

/**
 * States plainly that part of the video was never looked at.
 *
 * The API has always carried `failedChunks`, and this drawer never read it —
 * so a chunk a provider refused was invisible, and a user whose moment fell
 * inside it was told the video did not contain it. That is the same false
 * negative as a real miss, except nothing the user does can fix it.
 */
function CoverageGap({ request, onSeek }: { request: ClipRequest; onSeek: (seconds: number) => void }) {
  const coverage = request.coverage
  if (!coverage || coverage.complete) return null

  // A stretch we had not watched yet when the question was asked is not a
  // stretch we could not look at. It is said in the answer instead, in words
  // that are true of it — this box would call it a failure.
  const gaps = (coverage.gaps ?? []).filter((gap) => gap.reason !== "not_read_yet")
  const degraded = coverage.degraded ?? []

  // Two different caveats. A gap was never looked at; a degraded window was
  // looked at without its speech. Saying "missed" about the second would be
  // wrong — its matches are real.
  const gapLine =
    gaps.length > 0
      ? `I couldn't look at ${describeDuration(coverage.unsearchedSeconds)} of this video, so I'd have missed anything in ${gaps.length === 1 ? "it" : "those bits"}.`
      : coverage.locatable === false
        ? "There's part of this video I couldn't look at, so I may have missed something."
        : null

  // Nothing left to say once the not-yet-watched stretches are taken out —
  // and an empty amber box is a warning about nothing.
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
 * The moments we found and did not show.
 *
 * A match under the confidence threshold used to be dropped silently, and the
 * answer said nothing matched — which a person cannot tell apart from their
 * video genuinely not containing it. Saying "I saw something here, I'm not
 * sure" is both more honest and more useful, and it costs one quiet line.
 *
 * Kept deliberately plain: these are not results. No meter, no thumbs, nothing
 * to cut. Just a time you can jump to and judge yourself.
 */
function UncertainMoments({
  request,
  onSeek,
  onLookAgain,
}: {
  request: ClipRequest
  onSeek: (seconds: number) => void
  /** Null when looking again is not available — see the call site. */
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

export interface DrawerExchange {
  request: ClipRequest
  clips: Clip[]
}

/**
 * The question drawer: seated right of the stage, collapsible to a "?" disc.
 *
 * Shaped like a chat client, because that is what it is — the composer is
 * pinned to the bottom and the conversation scrolls above it, so the place you
 * type never moves as the thread grows. The shell itself never scrolls; only
 * the transcript region does, which is what keeps the composer seated.
 */
export function QueryDrawer({
  video,
  exchanges,
  busy,
  onSearch,
  onSeek,
  onClip,
  onRate,
  onReclip,
}: {
  video: Video
  exchanges: DrawerExchange[]
  busy: boolean
  onSearch: (instruction: string) => void
  onSeek: (seconds: number) => void
  onClip: (requestId: string, matchId: string) => void
  onRate: (requestId: string, matchId: string, verdict: MatchFeedback | null, reason?: MatchFeedbackReason | null) => void
  /** Ask the system to re-evaluate this SAME moment and cut it better. */
  onReclip: (requestId: string, matchId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const current = exchanges.at(-1) ?? null
  const searching = current?.request.status === "pending" || current?.request.status === "searching"

  const understanding =
    video.index?.status === "pending" || video.index?.status === "queued" || video.index?.status === "running"

  const canSend = draft.trim().length > 0 && video.readyForSearch && !busy && !searching

  /**
   * Follow the newest exchange. With the composer at the bottom, an answer that
   * arrives off-screen reads as nothing having happened — so track the last
   * status too, not just the count, or the reply that replaces "Searching…"
   * lands unseen.
   */
  const lastStatus = current?.request.status
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" })
  }, [exchanges.length, lastStatus, current?.clips.length])

  const submit = () => {
    const instruction = draft.trim()
    if (!instruction || busy || searching) return
    setDraft("")
    onSearch(instruction)
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="opener"
            type="button"
            aria-label="Ask the video"
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-shprimary text-lg font-medium text-primary-foreground shadow-[0_8px_30px_rgba(18,18,18,0.25)] lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            ?
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside
            key="drawer"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.45, ease: EASE }}
            /* Fixed shape, hidden overflow: the shell holds still while the
               transcript inside it scrolls. On small screens it takes a bounded
               height for the same reason — without one, flex-1 has nothing to
               divide and the composer stops being pinned. */
            className="z-30 mt-6 flex h-[70vh] w-full flex-col overflow-hidden rounded-2xl bg-shcard shadow-sm ring-1 ring-shborder lg:fixed lg:right-6 lg:top-24 lg:bottom-8 lg:mt-0 lg:h-auto lg:w-[350px]"
          >
            {/* header */}
            <div className="flex shrink-0 items-center justify-between border-b border-shborder px-4 py-3">
              <h2 className="text-lg font-semibold">Ask the video</h2>
              <button
                type="button"
                aria-label="Collapse"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-shaccent hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>

            {/* transcript — the only scrolling region */}
            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              {video.readyForSearch && understanding && exchanges.length === 0 && (
                <p className="text-xs text-muted-foreground" style={{ animation: "pulse-soft 2.2s ease-in-out infinite" }}>
                  {video.index?.readThroughSeconds
                    ? `Still watching — ${describeMinutes(video.index.readThroughSeconds)} in so far. Ask away, and I'll answer from what I've seen.`
                    : "Still watching this video. Ask away — I'll answer as soon as I've seen enough."}
                </p>
              )}

              {/* Idle suggestions, reference-style follow-ups. */}
              {video.readyForSearch && exchanges.length === 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Try</p>
                  <div className="mt-1 flex flex-col">
                    {SUGGESTIONS.map((text, i) => (
                      <button
                        key={text}
                        type="button"
                        onClick={() => {
                          setDraft(text)
                          inputRef.current?.focus()
                        }}
                        className="-mx-1.5 flex items-center gap-2 rounded-lg border-b border-shborder px-1.5 py-2 text-left text-[13px] transition-colors hover:bg-shaccent"
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

              {/* The conversation: every exchange stays, oldest first. */}
              {exchanges.map((exchange, index) => (
                <ExchangeBlock
                  key={exchange.request.id}
                  exchange={exchange}
                  playbackUrl={video.playback?.url ?? null}
                  onSeek={onSeek}
                  onClip={onClip}
                  onRate={onRate}
                  onReclip={onReclip}
                  onSearch={onSearch}
                  stillWatching={understanding}
                  readThroughSeconds={video.index?.readThroughSeconds ?? null}
                  // "Look again" means the last thing asked, because that is
                  // what it means to the backend and to a person. Offering it
                  // on an older answer would quietly re-run a different
                  // question than the one being looked at.
                  isLatest={index === exchanges.length - 1}
                  canAsk={canSend || (!busy && !searching && video.readyForSearch)}
                />
              ))}
            </div>

            {/* composer — pinned, so the place you type never moves */}
            <div className="mt-auto shrink-0 border-t border-shborder p-2">
              {!video.readyForSearch && (
                <p className="px-1 pb-2 text-xs text-muted-foreground">Available once processing finishes.</p>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  submit()
                }}
              >
                <div
                  role="presentation"
                  onClick={() => inputRef.current?.focus()}
                  className="flex cursor-text items-end gap-2 rounded-xl bg-shmuted p-2 ring-1 ring-shborder transition-[box-shadow] duration-150 focus-within:ring-ring"
                >
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
                    rows={2}
                    placeholder="Ask for a moment in this video"
                    className="max-h-32 min-h-[3rem] w-full resize-none bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
                    disabled={!video.readyForSearch}
                  />
                  <button
                    type="submit"
                    aria-label="Search"
                    disabled={!canSend}
                    /* Filled only when there is something to send, so the
                       button reads as available rather than merely present. */
                    className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.96] ${
                      canSend ? "bg-shprimary text-primary-foreground" : "bg-shmuted text-muted-foreground"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

function ExchangeBlock({
  exchange,
  playbackUrl,
  onSeek,
  onClip,
  onRate,
  onReclip,
  onSearch,
  isLatest,
  canAsk,
  stillWatching,
  readThroughSeconds,
}: {
  exchange: DrawerExchange
  /** The source video's own stream, for previewing a moment in place. */
  playbackUrl: string | null
  onSeek: (seconds: number) => void
  onClip: (requestId: string, matchId: string) => void
  onRate: (requestId: string, matchId: string, verdict: MatchFeedback | null, reason?: MatchFeedbackReason | null) => void
  onReclip: (requestId: string, matchId: string) => void
  onSearch: (instruction: string) => void
  isLatest: boolean
  canAsk: boolean
  /** The video is still being read, so a pending search is waiting on it. */
  stillWatching: boolean
  /** How far the watching has got, for an answer given before it finished. */
  readThroughSeconds: number | null
}) {
  const { request, clips } = exchange
  const searching = request.status === "pending" || request.status === "searching"
  const matches = request.status === "completed" ? (request.matches ?? []) : []
  const clipByMatch = useMemo(() => new Map(clips.map((clip) => [clip.clipMatchId, clip])), [clips])

  return (
    <div className="flex flex-col gap-3">
      {/* The question, as the person asked it — right-aligned, so the thread
          reads as a conversation rather than a list of results. */}
      <div className="flex justify-end pl-10">
        <div
          className="rounded-2xl bg-shmuted px-3 py-1.5 text-[13px] leading-[1.4]"
          style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}
        >
          {request.instruction}
        </div>
      </div>

      {searching ? (
        <p className="text-sm text-muted-foreground" style={{ animation: "pulse-soft 1.8s ease-in-out infinite" }}>
          {/* While a video is still being watched, a search that has not come
              back yet is usually waiting for the next part to be read. Saying
              "searching" there is true but unhelpful — it looks stuck, which
              is the complaint this whole change came from. */}
          {stillWatching
            ? "Still taking notes on this video — I'll answer the moment I've seen enough."
            : "Looking through what I know about this video…"}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <StreamedLine
            key={request.id + request.status}
            text={answerLine(request, readThroughSeconds)}
            className={`text-sm leading-relaxed ${request.status === "failed" ? "text-destructive" : ""}`}
          />
          {/* Recalled and re-read are different acts, and the difference
              matters to someone deciding whether to trust the answer. Said
              once, quietly, rather than dressed up as a badge. */}
          {request.answeredFrom === "notes" && (
            <span className="text-[11.5px] text-muted-foreground/80">From what I remember of this video</span>
          )}
        </div>
      )}

      {!searching && <CoverageGap request={request} onSeek={onSeek} />}

      {!searching && (
        <UncertainMoments
          request={request}
          onSeek={onSeek}
          // The same words a person would type. "Look again" is already
          // understood as a correction, so the button is the phrase made
          // visible rather than a second way in.
          onLookAgain={isLatest && canAsk ? () => onSearch("look again") : null}
        />
      )}

      {matches.length > 0 && (
        <EvidencePicker
          matches={matches}
          clipByMatch={clipByMatch}
          playbackUrl={playbackUrl}
          onSeek={onSeek}
          onClip={(matchId) => onClip(request.id, matchId)}
          onRate={(matchId, verdict, reason) => onRate(request.id, matchId, verdict, reason)}
          onReclip={(matchId) => onReclip(request.id, matchId)}
          hotkeys={isLatest}
        />
      )}
    </div>
  )
}

/** Three bars: how sure the model was, at a glance rather than as a number. */
function Meter({ confidence }: { confidence: number }) {
  const filled = confidence >= 0.8 ? 3 : confidence >= 0.5 ? 2 : 1
  const tone = filled === 3 ? "#4ade80" : filled === 2 ? "#fbbf24" : "#f87171"

  return (
    <span className="flex items-end gap-0.5" aria-hidden>
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="w-1 rounded-full transition-colors duration-300"
          style={{ height: 10, background: bar < filled ? tone : "rgba(255,255,255,0.15)" }}
        />
      ))}
    </span>
  )
}

/**
 * The same judgement in one word, for the alternative rows.
 *
 * The meter alone is three coloured bars — comparing options by decoding bar
 * counts is work. The word is what actually gets read; the meter is what makes
 * it scannable. The full label does not fit beside a timecode and a
 * description in a 350px drawer, so it is shortened rather than dropped.
 */
function shortConfidence(confidence: number): string {
  if (confidence >= 0.8) return "High"
  if (confidence >= 0.5) return "Likely"
  return "Unsure"
}

/**
 * The matches, as one recommendation with the rest a tap away.
 *
 * Stacking every match as its own card made four equal-weight answers to a
 * question that has one: people come to find THE moment, not to browse
 * moments. The strongest is promoted, the others live behind "Alternatives",
 * and picking one swaps it in — the card keeps its shape throughout so the
 * primary action never moves under the cursor.
 */
/**
 * Holds each match's thumbnail at the first URL it arrived with.
 *
 * The backend signs thumbnail URLs per request, so the same still comes back
 * under a different string on every poll — and a clip being cut polls every
 * two seconds. Binding `src` straight to the newest one refetches every
 * visible image on every poll; `loading="lazy"` does not help, because a
 * changed src is a new resource to the browser, not a cached one. Same fix as
 * the source player in video-stage.tsx: pin the first signature and move to
 * the newest only when the pinned one actually fails.
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
      // Rebuilt rather than merged, so a match that disappears — a re-run
      // replaces the whole list — does not keep its URL alive forever.
      let changed = ids.length !== Object.keys(current).length
      const next: Record<string, string> = {}
      for (const id of ids) {
        next[id] = current[id] ?? latest[id]
        if (next[id] !== current[id]) changed = true
      }
      // Returning the same object is what stops this from looping: after the
      // first poll pins everything, later polls settle without a re-render.
      return changed ? next : current
    })
  }, [latest])

  const refresh = useCallback(
    (matchId: string) =>
      setPinned((current) => {
        // The pinned signature has expired; the newest one is the only thing
        // worth retrying, and only if it is actually a different URL.
        const fresh = latest[matchId]
        return fresh && fresh !== current[matchId] ? { ...current, [matchId]: fresh } : current
      }),
    [latest],
  )

  return [pinned, refresh] as const
}

function EvidencePicker({
  matches,
  clipByMatch,
  playbackUrl,
  onSeek,
  onClip,
  onRate,
  onReclip,
  hotkeys = false,
}: {
  matches: ClipMatch[]
  clipByMatch: Map<string, Clip>
  playbackUrl: string | null
  onSeek: (seconds: number) => void
  onClip: (matchId: string) => void
  onRate: (matchId: string, verdict: MatchFeedback | null, reason?: MatchFeedbackReason | null) => void
  onReclip: (matchId: string) => void
  /** Arrow keys decide, u/Backspace undoes — only for the newest answer. */
  hotkeys?: boolean
}) {
  const [thumbnails, refreshThumbnail] = usePinnedThumbnails(matches)
  /** The moment playing IN the card, right where its still was. */
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  /**
   * A decision just made: the chosen control fills for a beat before the
   * card leaves. The card is held on screen through the flash even though
   * its verdict is already persisted — confirmation first, then exit.
   */
  const [deciding, setDeciding] = useState<{ id: string; decision: "keep" | "skip" } | null>(null)
  /** The last skip, kept only so it can be taken back or explained. */
  const [undoableId, setUndoableId] = useState<string | null>(null)

  // The deck: undecided moments, strongest first. Kept and skipped cards
  // are gone from here — deciding is what removes them.
  const queue = useMemo(() => deckQueue(matches), [matches])

  useEffect(() => {
    if (!deciding) return
    const timer = setTimeout(() => setDeciding(null), 240)
    return () => clearTimeout(timer)
  }, [deciding])

  // The pill leaves on its own — unless the deck is empty, where it is the
  // only trace of the last decision and removing it on a timer would yank
  // the layout upward for no reason.
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
    // Persist FIRST, confirm second: the verdict and the cut are queued the
    // instant the button lands, and the flash is only the acknowledgement.
    onRate(match.id, "approved")
    onClip(match.id)
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
  // last skip back. Only on the newest answer, and never while typing.
  useEffect(() => {
    if (!hotkeys) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
      if (event.key === "ArrowRight" && active) keep(active)
      else if (event.key === "ArrowLeft" && active) skip(active)
      else if ((event.key === "u" || event.key === "Backspace") && undoable) undoSkip(undoable)
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotkeys, active?.id, undoable?.id, deciding])

  if (!active) {
    // Every moment decided. Say what happened; the kept cuts live in the
    // library, and the last skip can still be taken back from here.
    const kept = matches.filter((match) => match.feedback === "approved").length
    return (
      <div
        className="relative overflow-hidden rounded-xl bg-[#101013]"
        style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}
      >
        <DeckEndState kept={kept} total={matches.length} />
        {undoable && (
          <div className="px-3 pb-3">
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
        )}
      </div>
    )
  }

  const activeThumbnail = thumbnails[active.id] ?? null
  const clip = clipByMatch.get(active.id) ?? null
  const cut = clip?.status === "ready"
  const playable = cut && clip?.url
  const regenerating = active.reclipStatus === "pending"
  const behindCount = Math.min(2, Math.max(0, queue.length - 1))

  return (
    <div className="relative">
      {/* The deck's depth: shells for the candidates waiting behind this
          one, exactly as many as exist (capped at two). Pure information —
          "there is more after this decision". */}
      {Array.from({ length: behindCount }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-x-0 top-0 h-10 rounded-xl bg-white/[0.045] ring-1 ring-white/5"
          style={{ transform: `scale(${1 - (i + 1) * 0.04}) translateY(-${(i + 1) * 7}px)`, zIndex: -1 - i, opacity: 0.7 - i * 0.3 }}
        />
      ))}

      <div
        className="relative overflow-hidden rounded-xl bg-[#101013]"
        style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) 200ms both" }}
      >
        <div className="relative p-3">
          <ReclipCardButton
            pending={regenerating}
            remaining={active.reclipsRemaining ?? 0}
            onReclip={() => onReclip(active.id)}
          />
          {regenerating && <RegeneratingOverlay />}

          {/* The moment, watchable right here. The still carries a play mark
              and the timecode in its corner; pressing it plays THIS moment in
              place, cued from the source video's own stream, and stops when
              the moment ends. Before the source is streamable the press falls
              back to jumping the main player. */}
          {!playable && previewingId !== active.id && (
            <button
              type="button"
              onClick={() => (playbackUrl ? setPreviewingId(active.id) : onSeek(active.startSeconds))}
              className="group/still relative block w-full overflow-hidden rounded-lg"
              aria-label={`Play this moment (${asPlayerTime(active.startSeconds)} to ${asPlayerTime(active.endSeconds)})`}
            >
              {activeThumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activeThumbnail}
                  alt=""
                  onError={() => refreshThumbnail(active.id)}
                  className="aspect-video w-full bg-black/50 object-cover"
                  style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
                />
              ) : (
                <span className="block aspect-video w-full bg-[#0b0e12]" />
              )}
              <span className="absolute inset-0 m-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/30 transition-transform group-hover/still:scale-105">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
                </svg>
              </span>
              <span className="absolute bottom-1.5 right-1.5 rounded-[5px] bg-black/80 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-white">
                {asPlayerTime(active.endSeconds - active.startSeconds)}
              </span>
            </button>
          )}

          {!playable && previewingId === active.id && playbackUrl && (
            <span className="relative block overflow-hidden rounded-lg">
              <video
                src={playbackUrl}
                autoPlay
                controls
                playsInline
                onLoadedMetadata={(event) => {
                  event.currentTarget.currentTime = active.startSeconds
                }}
                onPlay={(event) => {
                  const element = event.currentTarget
                  // One soundtrack at a time: starting the preview silences
                  // any other player on the page — the stage most of all.
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
                className="aspect-video w-full bg-black"
              />
              <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-[5px] bg-black/80 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-white">
                {asPlayerTime(active.endSeconds - active.startSeconds)}
              </span>
            </span>
          )}

          {playable && clip?.url && (
            <video
              src={clip.url}
              controls
              preload="metadata"
              playsInline
              className="w-full rounded-lg bg-black/60"
              style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
            />
          )}
        </div>

        <div className="border-t border-white/10 bg-black/20 px-2.5 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <Meter confidence={active.confidence} />
              <span className="truncate text-[12px] font-medium text-white/60">
                {Math.round(active.confidence * 100)}% accuracy
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              {(active.reclipCount ?? 0) > 0 && !regenerating && (
                <span className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/60 ring-1 ring-white/15">
                  Re-clipped
                </span>
              )}
              {queue.length > 1 && (
                <span className="whitespace-nowrap text-[11px] tabular-nums text-white/60">
                  {queue.length} to review
                </span>
              )}
            </span>
          </div>

          <DeckControls
            onSkip={() => skip(active)}
            onKeep={() => keep(active)}
            disabled={regenerating}
            deciding={deciding?.id === active.id ? deciding.decision : null}
          />

          {/* One reserved line for status, so a failure appearing cannot
              resize the card under the person's cursor. */}
          <p className="mt-1.5 h-4 truncate text-center text-[11px] text-amber-300/80" data-testid="deck-status">
            {active.reclipStatus === "failed" ? (active.reclipError ?? "Re-clip didn't work. The original is untouched — try again.") : ""}
          </p>
        </div>
      </div>

      {/* Floated over the card rather than added to it: the skip is done and
          the next candidate already up; this is the take-back and the
          optional word, leaving on its own. */}
      <AnimatePresence>
        {undoable && (
          <motion.div
            key="skip-pill"
            className="pointer-events-none absolute inset-x-3 top-3 z-20"
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
  )
}
