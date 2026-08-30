"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Clip, ClipMatch, ClipRequest, MatchFeedback, MatchFeedbackReason, Video } from "@/lib/types"

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
  onAdjust,
}: {
  video: Video
  exchanges: DrawerExchange[]
  busy: boolean
  onSearch: (instruction: string) => void
  onSeek: (seconds: number) => void
  onClip: (requestId: string, matchId: string) => void
  onRate: (requestId: string, matchId: string, verdict: MatchFeedback | null, reason?: MatchFeedbackReason | null) => void
  /** The person moving a saved clip's boundaries; re-renders in the background. */
  onAdjust: (requestId: string, clipId: string, startSeconds: number, endSeconds: number) => void
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
                  onAdjust={onAdjust}
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
  onAdjust,
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
  onAdjust: (requestId: string, clipId: string, startSeconds: number, endSeconds: number) => void
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
          onAdjust={(clipId, startSeconds, endSeconds) => onAdjust(request.id, clipId, startSeconds, endSeconds)}
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
  onAdjust,
}: {
  matches: ClipMatch[]
  clipByMatch: Map<string, Clip>
  playbackUrl: string | null
  onSeek: (seconds: number) => void
  onClip: (matchId: string) => void
  onRate: (matchId: string, verdict: MatchFeedback | null, reason?: MatchFeedbackReason | null) => void
  onAdjust: (clipId: string, startSeconds: number, endSeconds: number) => void
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
  /** The moment playing IN the card, right where its still was. */
  const [previewingId, setPreviewingId] = useState<string | null>(null)

  // Looked up rather than stored, so the strip cannot outlive the rejection it
  // describes. A failed thumbs-down is rolled back upstream and the moment
  // reappears in the list — a remembered copy would leave the card showing
  // both the moment and an offer to undo removing it.
  const undoable = matches.find((match) => match.id === undoableId && match.feedback === "rejected") ?? null

  const rate = (match: ClipMatch, verdict: MatchFeedback | null) => {
    setUndoableId(verdict === "rejected" ? match.id : null)
    onRate(match.id, verdict)
  }

  /**
   * The optional word after a thumbs-down. Sends the same rejection again
   * with the reason attached — the verdict is unchanged, so a failure here
   * loses a word, never a vote — and lets the offer leave.
   */
  const explain = (match: ClipMatch, reason: MatchFeedbackReason) => {
    onRate(match.id, "rejected", reason)
    setUndoableId(null)
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
      <div className="rounded-xl bg-shmuted/60 px-3 py-2 ring-1 ring-shborder">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[12px] text-muted-foreground">
            Removed <span className="font-mono tabular-nums">{undoable.startTimecode}</span>
          </span>
          <button
            type="button"
            onClick={() => rate(undoable, null)}
            className="shrink-0 whitespace-nowrap text-[12px] font-medium text-amber-700 transition-colors hover:text-amber-800"
          >
            Undo
          </button>
        </div>
        {/* Same optional word as the floating pill. This one matters more:
            with every moment waved off, "missed what I wanted" is the only
            way left to say the right moment never appeared at all. */}
        {undoable.feedbackReason == null && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {REJECTION_REASONS.map(({ reason, label }) => (
              <button
                key={reason}
                type="button"
                onClick={() => explain(undoable, reason)}
                className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-shborder transition-colors hover:bg-shmuted hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>
        )}
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
      className="relative overflow-hidden rounded-xl bg-[#101013]"
      style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) 200ms both" }}
    >
      <div className="p-3">
        {/* The moment, watchable right here. The still carries a play mark
            and the timecode in its corner; pressing it plays THIS moment in
            place, cued from the source video's own stream, and stops when the
            moment ends. Before the source is streamable the press falls back
            to jumping the main player. */}
        {!playable && previewingId !== active.id && (
          <button
            type="button"
            onClick={() => (playbackUrl ? setPreviewingId(active.id) : onSeek(active.startSeconds))}
            className="group/still relative block w-full overflow-hidden rounded-lg"
            aria-label={`Play this moment (${asPlayerTime(active.startSeconds)} to ${asPlayerTime(active.endSeconds)})`}
          >
            {/* No still is not no moment: the pane keeps its shape and its
                play control either way (a match's thumbnail is best-effort on
                the backend and the type says so). */}
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
                // One soundtrack at a time: starting the preview silences any
                // other player on the page — the stage most of all.
                for (const other of document.querySelectorAll("video")) {
                  if (other !== element) other.pause()
                }
                // Play after the cutoff means "again": rewind to the moment's
                // start instead of resuming past its end just to re-pause.
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
            <p className="px-1.5 pb-1 text-[11px] font-medium text-white/40">Other moments</p>
            {others.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => {
                  setSelectedId(match.id)
                  setPreviewingId(null)
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
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/80">
                  {match.description || SOURCE_LABEL[match.source]}
                </span>
                <span className="shrink-0 text-[11px] text-white/45">
                  {shortConfidence(match.confidence)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Two rows, because six controls do not fit across a 380px column. The
          previous single row squeezed "Save clip" until it wrapped onto
          three lines inside its own button. */}
      <div className="border-t border-white/10 bg-black/20 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Meter confidence={active.confidence} />
            <span className="truncate text-[12px] font-medium text-white/60">
              {Math.round(active.confidence * 100)}% accuracy
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
              className="flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-[12.5px] text-white/70 ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-white"
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
                <span style={{ animation: "pulse-soft 1.6s ease-in-out infinite" }}>Saving…</span>
              ) : clip?.status === "failed" ? (
                "Try again"
              ) : (
                "Save clip"
              )}
            </button>
          )}
        </div>

        {/* Only a finished clip can be moved: while it renders there is
            nothing to compare against, and the whole footer is already the
            busy state. A deliberate disclosure like "Other moments" above —
            opening it is a click, so the card growing here is the person's
            own doing, not something reacting under them. */}
        {cut && clip && (
          <BoundaryAdjuster
            clip={clip}
            onSave={(startSeconds, endSeconds) => onAdjust(clip.id, startSeconds, endSeconds)}
          />
        )}
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
            <UndoRejection
              match={undoable}
              onUndo={() => rate(undoable, null)}
              onReason={(reason) => explain(undoable, reason)}
            />
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
        className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-emerald-300"
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
        className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-red-300"
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
 * Moving a saved clip to where the moment actually is.
 *
 * Closed, it is one quiet line. Open, each boundary gets nudge buttons —
 * a second for the coarse move, a tenth for the fine one — against a live
 * timecode. Save hands the new boundaries to the server and the card falls
 * back into its rendering state; Cancel puts the drafts back and folds the
 * row away. The maths of it is the point: the model's original prediction
 * is kept server-side, so every save here is also a measurement of how far
 * off the model was.
 */
function BoundaryAdjuster({
  clip,
  onSave,
}: {
  clip: Clip
  onSave: (startSeconds: number, endSeconds: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(clip.startSeconds)
  const [end, setEnd] = useState(clip.endSeconds)

  // A re-render replaces the clip row; drafts from the previous file would
  // silently offer boundaries the person already saved.
  useEffect(() => {
    setStart(clip.startSeconds)
    setEnd(clip.endSeconds)
  }, [clip.startSeconds, clip.endSeconds])

  const dirty = start !== clip.startSeconds || end !== clip.endSeconds
  const valid = end - start >= 0.5

  const nudge = (which: "start" | "end", delta: number) => {
    if (which === "start") setStart((current) => Math.max(0, Number((current + delta).toFixed(1))))
    else setEnd((current) => Math.max(0, Number((current + delta).toFixed(1))))
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className="mt-2 w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-[11.5px] text-white/50 ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-white/80"
      >
        {clip.boundariesEditedAt ? "Adjust timing again" : "Adjust timing"}
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-lg bg-white/[0.04] p-2 ring-1 ring-white/10">
      {(["start", "end"] as const).map((which) => (
        <div key={which} className="flex items-center justify-between gap-1 py-0.5">
          <span className="w-9 shrink-0 text-[11px] uppercase tracking-wide text-white/40">{which}</span>
          <span className="flex items-center gap-1">
            {[-1, -0.1].map((delta) => (
              <NudgeButton key={delta} label={delta === -1 ? "−1s" : "−0.1"} onClick={() => nudge(which, delta)} />
            ))}
            <span className="w-[72px] text-center font-mono text-[12px] tabular-nums text-white/85">
              {asPlayerTime(which === "start" ? start : end)}
            </span>
            {[0.1, 1].map((delta) => (
              <NudgeButton key={delta} label={delta === 1 ? "+1s" : "+0.1"} onClick={() => nudge(which, delta)} />
            ))}
          </span>
        </div>
      ))}

      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setStart(clip.startSeconds)
            setEnd(clip.endSeconds)
            setOpen(false)
          }}
          className="flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11.5px] text-white/60 ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!dirty || !valid}
          onClick={() => {
            onSave(start, end)
            setOpen(false)
          }}
          className="flex-1 whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-[11.5px] font-medium text-black transition-transform active:scale-[0.97] disabled:opacity-40"
        >
          {valid ? "Save timing" : "End must follow start"}
        </button>
      </div>
    </div>
  )
}

function NudgeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="whitespace-nowrap rounded-md px-1.5 py-1 font-mono text-[10.5px] tabular-nums text-white/50 ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-white/90"
    >
      {label}
    </button>
  )
}

/**
 * The reasons a thumbs-down may (but never must) carry, in the product's own
 * words. Four, not nine: the backend accepts finer distinctions, but a row
 * of chips is an offer, and nine offers is a survey.
 */
const REJECTION_REASONS: ReadonlyArray<{ reason: MatchFeedbackReason; label: string }> = [
  { reason: "wrong_moment", label: "Wrong moment" },
  { reason: "missed_moment", label: "Missed what I wanted" },
  { reason: "bad_boundaries", label: "Timing is off" },
  { reason: "not_relevant", label: "Not useful" },
]

/**
 * A toast: which moment went, a way back, and one optional word on why —
 * for a few seconds.
 *
 * Only the buttons take clicks. The pill floats over the card, and anything
 * beneath the rest of it — including whichever button happens to be under
 * there — has to stay usable rather than being blocked for six seconds by a
 * label. The reasons are chips, not a form: tapping one is the whole
 * interaction, ignoring them costs nothing, and the toast leaves on its own
 * either way.
 */
function UndoRejection({
  match,
  onUndo,
  onReason,
}: {
  match: ClipMatch
  onUndo: () => void
  onReason: (reason: MatchFeedbackReason) => void
}) {
  return (
    <div className="rounded-2xl bg-black/85 px-3 py-1.5 shadow-lg ring-1 ring-white/15 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-[11.5px] text-white/60">
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
      {match.feedbackReason == null && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {REJECTION_REASONS.map(({ reason, label }) => (
            <button
              key={reason}
              type="button"
              onClick={() => onReason(reason)}
              className="pointer-events-auto whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] text-white/55 ring-1 ring-white/20 transition-colors hover:bg-white/10 hover:text-white/90"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
