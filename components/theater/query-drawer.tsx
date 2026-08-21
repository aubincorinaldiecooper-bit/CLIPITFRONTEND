"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Clip, ClipMatch, ClipRequest, MatchFeedback, Video } from "@/lib/types"

const EASE = [0.23, 1, 0.32, 1] as const

const SUGGESTIONS = [
  "Clip every time the energy peaks",
  "Find the part where they introduce themselves",
]

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
function answerLine(request: ClipRequest, readThrough?: string | null): string {
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
    const sofar = readThrough ? `the first ${readThrough}` : "the part I had watched"
    const found = count === 1 ? "Found one moment" : `Found ${count} moments`
    return `${found} in ${sofar}. I'm still watching the rest — ask again when I'm done and I'll cover the whole thing.`
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
  return `${found} Click one to jump there, or cut it into a clip.`
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
      className="rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-400/25"
      style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      {gapLine && <p className="text-[13px] leading-snug text-amber-200/90">{gapLine}</p>}
      {gaps.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {gaps.map((gap) => (
            <button
              key={`gap-${gap.startSeconds}-${gap.endSeconds}`}
              type="button"
              onClick={() => onSeek(gap.startSeconds)}
              className="rounded-lg bg-amber-400/10 px-2 py-1 font-mono text-[11px] tabular-nums text-amber-200/80 transition-colors hover:bg-amber-400/20"
            >
              {gap.startTimecode} – {gap.endTimecode}
            </button>
          ))}
        </div>
      )}

      {degraded.length > 0 && (
        <div className={gapLine ? "mt-3 border-t border-amber-400/15 pt-2.5" : ""}>
          <p className="text-[13px] leading-snug text-amber-200/90">
            {degraded.length === 1 ? "There's a bit" : `There are ${degraded.length} bits`} where I could see the
            video but not hear it, so I'd have missed anything that was only said out loud.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {degraded.map((window) => (
              <button
                key={`degraded-${window.startSeconds}-${window.endSeconds}`}
                type="button"
                onClick={() => onSeek(window.startSeconds)}
                className="rounded-lg bg-amber-400/10 px-2 py-1 font-mono text-[11px] tabular-nums text-amber-200/80 transition-colors hover:bg-amber-400/20"
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
    <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/10">
      <p className="text-[12.5px] leading-snug text-foreground/55">
        {uncertain.length === 1 ? "There's one moment" : `There are ${uncertain.length} moments`} I spotted but
        wasn't sure about.
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {uncertain.map((moment) => (
          <button
            key={`${moment.startSeconds}-${moment.endSeconds}`}
            type="button"
            onClick={() => onSeek(moment.startSeconds)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/5"
          >
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground/45">
              {moment.startTimecode}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/65">
              {moment.description || "Something worth a look"}
            </span>
          </button>
        ))}
      </div>
      {onLookAgain && (
        <button
          type="button"
          onClick={onLookAgain}
          className="mt-1.5 rounded-lg px-1.5 py-1 text-[12px] font-medium text-amber-300/80 transition-colors hover:bg-white/5 hover:text-amber-300"
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
}: {
  video: Video
  exchanges: DrawerExchange[]
  busy: boolean
  onSearch: (instruction: string) => void
  onSeek: (seconds: number) => void
  onClip: (requestId: string, matchId: string) => void
  onRate: (requestId: string, matchId: string, verdict: MatchFeedback | null) => void
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
            className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-medium text-black shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2"
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
            className="z-30 mt-6 flex h-[70vh] w-full flex-col overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10 backdrop-blur-md lg:fixed lg:right-6 lg:top-24 lg:bottom-8 lg:mt-0 lg:h-auto lg:w-[350px]"
          >
            {/* header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="font-serif text-lg">Ask the video</h2>
              <button
                type="button"
                aria-label="Collapse"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-white/10 hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>

            {/* transcript — the only scrolling region */}
            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              {video.readyForSearch && understanding && exchanges.length === 0 && (
                <p className="text-xs text-foreground/40" style={{ animation: "pulse-soft 2.2s ease-in-out infinite" }}>
                  {video.index?.readThroughTimecode && video.durationTimecode
                    ? `Still watching — I'm ${video.index.readThroughTimecode} into ${video.durationTimecode} so far. Ask anything now; I'll answer from what I've seen, and keep watching the rest.`
                    : "Still watching this video. Ask anything now — I'll answer as soon as I've seen enough."}
                </p>
              )}

              {/* Idle suggestions, reference-style follow-ups. */}
              {video.readyForSearch && exchanges.length === 0 && (
                <div>
                  <p className="text-xs font-medium text-foreground/50">Try</p>
                  <div className="mt-1 flex flex-col">
                    {SUGGESTIONS.map((text, i) => (
                      <button
                        key={text}
                        type="button"
                        onClick={() => {
                          setDraft(text)
                          inputRef.current?.focus()
                        }}
                        className="-mx-1.5 flex items-center gap-2 rounded-lg border-b border-white/5 px-1.5 py-2 text-left text-[13px] text-foreground/80 transition-colors hover:bg-white/5"
                        style={{ animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${i * 90}ms both` }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-foreground/30" aria-hidden>
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
                  onSeek={onSeek}
                  onClip={onClip}
                  onRate={onRate}
                  onSearch={onSearch}
                  stillWatching={understanding}
                  readThrough={video.index?.readThroughTimecode ?? null}
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
            <div className="mt-auto shrink-0 border-t border-white/10 p-2">
              {!video.readyForSearch && (
                <p className="px-1 pb-2 text-xs text-foreground/40">Available once processing finishes.</p>
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
                  className="flex cursor-text items-end gap-2 rounded-xl bg-black/40 p-2 ring-1 ring-white/10 transition-[box-shadow] duration-150 focus-within:ring-white/25"
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
                    className="max-h-32 min-h-[3rem] w-full resize-none bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-foreground/30"
                    disabled={!video.readyForSearch}
                  />
                  <button
                    type="submit"
                    aria-label="Search"
                    disabled={!canSend}
                    /* Filled only when there is something to send, so the
                       button reads as available rather than merely present. */
                    className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.96] ${
                      canSend ? "bg-white text-black" : "bg-white/10 text-foreground/40"
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
  onSeek,
  onClip,
  onRate,
  onSearch,
  isLatest,
  canAsk,
  stillWatching,
  readThrough,
}: {
  exchange: DrawerExchange
  onSeek: (seconds: number) => void
  onClip: (requestId: string, matchId: string) => void
  onRate: (requestId: string, matchId: string, verdict: MatchFeedback | null) => void
  onSearch: (instruction: string) => void
  isLatest: boolean
  canAsk: boolean
  /** The video is still being read, so a pending search is waiting on it. */
  stillWatching: boolean
  /** How far the watching has got, for an answer given before it finished. */
  readThrough: string | null
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
          className="rounded-2xl bg-white/10 px-3 py-1.5 text-[13px] leading-[1.4] text-foreground"
          style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}
        >
          {request.instruction}
        </div>
      </div>

      {searching ? (
        <p className="text-sm text-foreground/70" style={{ animation: "pulse-soft 1.8s ease-in-out infinite" }}>
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
            text={answerLine(request, readThrough)}
            className={`text-sm leading-relaxed ${request.status === "failed" ? "text-red-300" : "text-foreground/90"}`}
          />
          {/* Recalled and re-read are different acts, and the difference
              matters to someone deciding whether to trust the answer. Said
              once, quietly, rather than dressed up as a badge. */}
          {request.answeredFrom === "notes" && (
            <span className="text-[11.5px] text-foreground/35">From what I remember of this video</span>
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
          onSeek={onSeek}
          onClip={(matchId) => onClip(request.id, matchId)}
          onRate={(matchId, verdict) => onRate(request.id, matchId, verdict)}
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

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High confidence"
  if (confidence >= 0.5) return "Likely"
  return "Worth checking"
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
  onSeek,
  onClip,
  onRate,
}: {
  matches: ClipMatch[]
  clipByMatch: Map<string, Clip>
  onSeek: (seconds: number) => void
  onClip: (matchId: string) => void
  onRate: (matchId: string, verdict: MatchFeedback | null) => void
}) {
  // Best first, so the promoted one is the model's strongest answer rather
  // than whichever chunk happened to finish first. Rejected moments drop out
  // entirely: a thumbs-down means "this is not what I asked for", and leaving
  // it in the list would be arguing with the person who said so.
  const ranked = useMemo(
    () => matches.filter((match) => match.feedback !== "rejected").sort((a, b) => b.confidence - a.confidence),
    [matches],
  )
  // The moment most recently waved off, kept only so it can be put back. A
  // thumbs-down is one tap and removes something from view, which is exactly
  // the shape of action that needs an undo next to it.
  const [undoableId, setUndoableId] = useState<string | null>(null)

  /**
   * The undo offer leaves on its own.
   *
   * It was a strip welded to the bottom of the card, which is the wrong shape
   * for it: a permanent row in a card reads as a permanent fact, and this is
   * news about something that just happened. Six seconds is long enough to
   * catch a mis-tap and short enough not to become furniture.
   */
  useEffect(() => {
    if (!undoableId) return
    // Only the floating toast expires. When every moment has been waved off
    // the undo is the only thing left in that answer — not news over a card
    // but the record of what happened — and removing it on a timer would make
    // the whole thread jump upward six seconds after a click.
    if (ranked.length === 0) return
    const timer = setTimeout(() => setUndoableId(null), 6000)
    return () => clearTimeout(timer)
  }, [undoableId, ranked.length])
  const [thumbnails, refreshThumbnail] = usePinnedThumbnails(matches)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  // Looked up rather than stored, so the strip cannot outlive the rejection it
  // describes. A failed thumbs-down is rolled back upstream and the moment
  // reappears in the list — a remembered copy would leave the card showing
  // both the moment and an offer to undo removing it.
  const undoable = matches.find((match) => match.id === undoableId && match.feedback === "rejected") ?? null

  const rate = (match: ClipMatch, verdict: MatchFeedback | null) => {
    setUndoableId(verdict === "rejected" ? match.id : null)
    onRate(match.id, verdict)
  }

  // Fall back rather than pin an index: polling replaces the match list, and
  // a stale index would silently promote a different moment.
  const active = ranked.find((match) => match.id === selectedId) ?? ranked[0]

  // Everything has been waved off. The undo has to outlive the card it came
  // from, or rejecting the last moment would take its own undo with it.
  if (!active) {
    // Nothing to float over, so this is not a toast. Inline, quiet, and it
    // stays: it is the only trace of what was removed.
    return undoable ? (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
        <span className="truncate text-[12px] text-foreground/45">
          Removed <span className="font-mono tabular-nums">{undoable.startTimecode}</span>
        </span>
        <button
          type="button"
          onClick={() => rate(undoable, null)}
          className="shrink-0 whitespace-nowrap text-[12px] font-medium text-amber-300/90 transition-colors hover:text-amber-300"
        >
          Undo
        </button>
      </div>
    ) : null
  }

  const others = ranked.filter((match) => match.id !== active.id)
  const activeThumbnail = thumbnails[active.id] ?? null
  const clip = clipByMatch.get(active.id) ?? null
  const busy = clip?.status === "pending" || clip?.status === "generating"
  // Three separate facts, because one flag conflated them. A cut clip is
  // playable as soon as it has a url; it is downloadable only once the backend
  // also signs an attachment url. Gating playback on the download url hid the
  // player for a clip that existed AND offered to cut it again — an action
  // that cannot progress, since polling stops once a clip reports ready.
  const cut = clip?.status === "ready"
  const playable = cut && clip?.url
  const downloadable = cut && clip?.downloadUrl

  return (
    <div
      className="relative overflow-hidden rounded-xl bg-black/35 ring-1 ring-white/10"
      style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) 200ms both" }}
    >
      <div className="p-3">
        <button type="button" onClick={() => onSeek(active.startSeconds)} className="group block w-full text-left">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono tabular-nums text-amber-300/90 underline-offset-4 group-hover:underline">
              {active.startTimecode} – {active.endTimecode}
            </span>
            <span className="text-foreground/35">{SOURCE_LABEL[active.source]}</span>
          </div>
          {/* Fixed min-height: swapping between alternatives must not make the
              card jump, or the buttons below move as you read. */}
          <p className="mt-1.5 min-h-[2.5rem] text-[13px] leading-snug text-foreground/85">
            {active.description || "A moment matching your search."}
          </p>
          {active.quote && <p className="mt-1 text-xs italic text-foreground/45">“{active.quote}”</p>}
        </button>

        {/* Before the clip is cut there is nothing to play, so the still
            stands in — the promoted match should never be the only one you
            cannot see. */}
        {!playable && activeThumbnail && (
          <button
            type="button"
            onClick={() => onSeek(active.startSeconds)}
            className="mt-2.5 block w-full overflow-hidden rounded-lg ring-1 ring-white/10"
            aria-label={`Jump to ${active.startTimecode}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeThumbnail}
              alt=""
              onError={() => refreshThumbnail(active.id)}
              className="aspect-video w-full bg-black/50 object-cover"
              style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
            />
          </button>
        )}

        {playable && clip?.url && (
          <video
            src={clip.url}
            controls
            preload="metadata"
            playsInline
            className="mt-2.5 w-full rounded-lg bg-black/60"
            style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
          />
        )}
      </div>

      {/* Alternatives, as their own section of the card rather than a popover. */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/10 bg-black/20 p-1.5">
            <p className="px-1.5 pb-1 text-[11px] font-medium text-foreground/40">Other moments</p>
            {others.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => {
                  setSelectedId(match.id)
                  // Seek too: switching the answer should move the player to it,
                  // otherwise the card and the video disagree about the subject.
                  onSeek(match.startSeconds)
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors duration-100 hover:bg-white/5"
              >
                <Meter confidence={match.confidence} />
                {/* 16:9 whether or not the image loads, so a row without a
                    still keeps the same shape as the ones around it. */}
                <span className="relative h-9 w-16 shrink-0 overflow-hidden rounded bg-black/50 ring-1 ring-white/10">
                  {thumbnails[match.id] && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbnails[match.id]}
                      alt=""
                      loading="lazy"
                      onError={() => refreshThumbnail(match.id)}
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-amber-300/70">
                  {match.startTimecode}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/80">
                  {match.description || SOURCE_LABEL[match.source]}
                </span>
                <span className="shrink-0 text-[11px] text-foreground/40">
                  {shortConfidence(match.confidence)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Two rows, because six controls do not fit across a 380px column. The
          previous single row squeezed "Cut this clip" until it wrapped onto
          three lines inside its own button. */}
      <div className="border-t border-white/10 bg-black/20 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Meter confidence={active.confidence} />
            <span className="truncate text-[12px] font-medium text-foreground/60">
              {confidenceLabel(active.confidence)}
            </span>
          </span>
          <Verdict match={active} onRate={(verdict) => rate(active, verdict)} />
        </div>

        <div className="mt-2 flex items-center gap-2">
          {others.length > 0 && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
              className="flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-[12.5px] text-foreground/70 ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {open ? "Hide other moments" : `Other moments (${others.length})`}
            </button>
          )}

          {downloadable ? (
            /* A plain link, not a fetch: the URL is signed with an attachment
               disposition, so the browser saves it without the page touching
               the bytes. `download` alone would not work cross-origin. */
            <a
              href={clip!.downloadUrl!}
              download
              className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-3 py-2 text-[12.5px] font-medium text-black transition-transform active:scale-[0.97]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
              </svg>
              Download
            </a>
          ) : cut ? (
            /* Cut, but this deployment has no attachment url yet. The player
               above is the affordance; offering to cut it again would be a
               button that cannot do anything. */
            null
          ) : (
            <button
              type="button"
              onClick={() => onClip(active.id)}
              disabled={busy}
              /* Fixed width for the label that changes: "Cutting…" and "Cut
                 this clip" must not resize the button under the cursor. */
              className="flex-1 whitespace-nowrap rounded-lg bg-white px-3 py-2 text-[12.5px] font-medium text-black transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? (
                <span style={{ animation: "pulse-soft 1.6s ease-in-out infinite" }}>Cutting…</span>
              ) : clip?.status === "failed" ? (
                "Try again"
              ) : (
                "Cut this clip"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Floated over the card rather than added to it: removing a moment must
          not also resize the thing you are looking at. */}
      <AnimatePresence>
        {undoable && (
          <motion.div
            key="undo"
            className="pointer-events-none absolute right-2 top-2 flex justify-end"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <UndoRejection match={undoable} onUndo={() => rate(undoable, null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Thumbs up and down on the promoted moment.
 *
 * Only on the promoted one: rating every alternative row in place would put
 * two more targets in a line that is already a timecode, a description and a
 * confidence, and choosing an alternative promotes it anyway. So the moment
 * you are looking at is the moment you can judge.
 *
 * Approving replaces both icons with the verdict itself. The rating gesture is
 * finished, and leaving a live thumbs-up next to an approved clip invites the
 * question of whether the first tap registered — but the mark stays clickable,
 * because the only thing worse than no undo is an undo you cannot find.
 */
function Verdict({ match, onRate }: { match: ClipMatch; onRate: (verdict: MatchFeedback | null) => void }) {
  if (match.feedback === "approved") {
    return (
      <button
        type="button"
        onClick={() => onRate(null)}
        title="Approved — click to undo"
        className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-emerald-300/80 transition-colors hover:bg-white/5"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
        Approved
      </button>
    )
  }

  return (
    <span className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onRate("approved")}
        aria-label="This clip is right"
        title="This clip is right"
        className="rounded-lg p-1.5 text-foreground/35 transition-colors hover:bg-white/5 hover:text-emerald-300"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 22V10l5-8a2.5 2.5 0 0 1 2.4 3.2L13.5 9H19a2 2 0 0 1 2 2.4l-1.6 8A2 2 0 0 1 17.4 21H7Z" />
          <path d="M7 10H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onRate("rejected")}
        aria-label="This clip is wrong — remove it"
        title="This clip is wrong — remove it"
        className="rounded-lg p-1.5 text-foreground/35 transition-colors hover:bg-white/5 hover:text-red-300"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M17 2v12l-5 8a2.5 2.5 0 0 1-2.4-3.2L10.5 15H5a2 2 0 0 1-2-2.4l1.6-8A2 2 0 0 1 6.6 3H17Z" />
          <path d="M17 14h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-3" />
        </svg>
      </button>
    </span>
  )
}

/**
 * A toast: which moment went, and a way back, for a few seconds.
 *
 * Only the Undo button takes clicks. The pill floats over the card, and
 * anything beneath the rest of it — including whichever button happens to be
 * under there — has to stay usable rather than being blocked for six seconds
 * by a label.
 */
function UndoRejection({ match, onUndo }: { match: ClipMatch; onUndo: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-full bg-black/85 px-3 py-1.5 shadow-lg ring-1 ring-white/15 backdrop-blur">
      <span className="whitespace-nowrap text-[11.5px] text-foreground/60">
        Removed <span className="font-mono tabular-nums">{match.startTimecode}</span>
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="pointer-events-auto whitespace-nowrap text-[11.5px] font-medium text-amber-300/90 transition-colors hover:text-amber-300"
      >
        Undo
      </button>
    </div>
  )
}
