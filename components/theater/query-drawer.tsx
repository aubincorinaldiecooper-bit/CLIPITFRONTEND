"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { Clip, ClipMatch, ClipRequest, Video } from "@/lib/types"

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

function answerLine(request: ClipRequest): string {
  const count = request.matches?.length ?? 0
  if (request.status === "failed") return request.error ?? "The search failed."
  if (count === 0) {
    // Telling someone to rephrase is wrong when part of the video was never
    // read. The gap itself is shown separately; this only stops the copy from
    // asserting an absence it cannot vouch for.
    return request.coverage?.complete === false
      ? "Nothing in the parts of the video I could examine matches that."
      : "Nothing in the video matches that. Try describing the moment differently."
  }
  return count === 1
    ? "Found one moment. Click it to jump there — or cut it as a clip."
    : `Found ${count} moments. Click one to jump there — or cut them as clips.`
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

  const gaps = coverage.gaps ?? []
  const degraded = coverage.degraded ?? []

  // Two different caveats. A gap was never looked at; a degraded window was
  // looked at without its speech. Saying "missed" about the second would be
  // wrong — its matches are real.
  const gapLine =
    gaps.length > 0
      ? `${describeDuration(coverage.unsearchedSeconds)} of this video could not be examined, so anything in ${gaps.length === 1 ? "that stretch" : "those stretches"} would have been missed.`
      : coverage.locatable === false
        ? "Part of this video could not be examined, so something there may have been missed."
        : null

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
            {degraded.length === 1 ? "One stretch was" : `${degraded.length} stretches were`} searched without
            speech, so anything only said out loud there could not be matched.
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
}: {
  video: Video
  exchanges: DrawerExchange[]
  busy: boolean
  onSearch: (instruction: string) => void
  onSeek: (seconds: number) => void
  onClip: (requestId: string, matchId: string) => void
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
                  Still watching the video — you can ask now, the search will wait for it.
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
              {exchanges.map((exchange) => (
                <ExchangeBlock key={exchange.request.id} exchange={exchange} onSeek={onSeek} onClip={onClip} />
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
                    placeholder='e.g. "find the part where they see a cybertruck"'
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
}: {
  exchange: DrawerExchange
  onSeek: (seconds: number) => void
  onClip: (requestId: string, matchId: string) => void
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
          Searching what I know about this video…
        </p>
      ) : (
        <StreamedLine
          key={request.id + request.status}
          text={answerLine(request)}
          className={`text-sm leading-relaxed ${request.status === "failed" ? "text-red-300" : "text-foreground/90"}`}
        />
      )}

      {!searching && <CoverageGap request={request} onSeek={onSeek} />}

      {matches.length > 0 && (
        <EvidencePicker
          matches={matches}
          clipByMatch={clipByMatch}
          onSeek={onSeek}
          onClip={(matchId) => onClip(request.id, matchId)}
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
 * The matches, as one recommendation with the rest a tap away.
 *
 * Stacking every match as its own card made four equal-weight answers to a
 * question that has one: people come to find THE moment, not to browse
 * moments. The strongest is promoted, the others live behind "Alternatives",
 * and picking one swaps it in — the card keeps its shape throughout so the
 * primary action never moves under the cursor.
 */
function EvidencePicker({
  matches,
  clipByMatch,
  onSeek,
  onClip,
}: {
  matches: ClipMatch[]
  clipByMatch: Map<string, Clip>
  onSeek: (seconds: number) => void
  onClip: (matchId: string) => void
}) {
  // Best first, so the promoted one is the model's strongest answer rather
  // than whichever chunk happened to finish first.
  const ranked = useMemo(
    () => [...matches].sort((a, b) => b.confidence - a.confidence),
    [matches],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  // Fall back rather than pin an index: polling replaces the match list, and
  // a stale index would silently promote a different moment.
  const active = ranked.find((match) => match.id === selectedId) ?? ranked[0]
  if (!active) return null

  const others = ranked.filter((match) => match.id !== active.id)
  const clip = clipByMatch.get(active.id) ?? null
  const busy = clip?.status === "pending" || clip?.status === "generating"
  const ready = clip?.status === "ready" && clip.downloadUrl

  return (
    <div
      className="overflow-hidden rounded-xl bg-black/35 ring-1 ring-white/10"
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

        {ready && clip?.url && (
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
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-amber-300/70">
                  {match.startTimecode}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/80">
                  {match.description || SOURCE_LABEL[match.source]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-2.5 py-2">
        <span className="flex items-center gap-2">
          <Meter confidence={active.confidence} />
          <span className="text-[12px] font-medium text-foreground/60">{confidenceLabel(active.confidence)}</span>
        </span>

        <span className="flex items-center gap-2">
          {others.length > 0 && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-foreground/70 ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {others.length} other{others.length === 1 ? "" : "s"}
            </button>
          )}

          {ready ? (
            /* A plain link, not a fetch: the URL is signed with an attachment
               disposition, so the browser saves it without the page touching
               the bytes. `download` alone would not work cross-origin. */
            <a
              href={clip!.downloadUrl!}
              download
              className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-medium text-black transition-transform active:scale-[0.97]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
              </svg>
              Download
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onClip(active.id)}
              disabled={busy}
              className="rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-medium text-black transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? (
                <span style={{ animation: "pulse-soft 1.6s ease-in-out infinite" }}>Cutting…</span>
              ) : clip?.status === "failed" ? (
                "Retry"
              ) : (
                "Cut this clip"
              )}
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
