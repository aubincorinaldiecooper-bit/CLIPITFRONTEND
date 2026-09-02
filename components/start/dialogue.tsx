"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import type { Video } from "@/lib/types"
import { cn } from "@/lib/utils"
import { answerLine, coverageLine, uncertainLine } from "./answer-words"
import type { FeedMoment } from "./moment-feed"
import type { Exchange } from "./types"

/**
 * The dialogue beside the feed — the owner's screen of 2026-09-02.
 *
 * Every question asked of this video, and what came of it, in order. A new
 * question is a new search: its moments land in the feed as the server
 * cuts them. Words that ask for the moment ON SCREEN to be reworked —
 * "tighten this one", "re-cut it" — go to Re-clip instead of to a search.
 *
 * One honesty rule sits in the middle of that: the system cannot yet follow
 * the WORDS of an edit. A Re-clip re-reads the footage around the moment
 * for a better standalone cut; it does not trim an intro because it was
 * asked to. So the dialogue says exactly that when it takes an edit, rather
 * than letting "trim the slow intro" look obeyed.
 */

/**
 * A word the dialogue adds itself — a Re-clip taken, or refused. Placed
 * after the question it followed. A note about a re-cut that started
 * carries the moment's id instead of fixed words: what it says follows the
 * moment — underway, failed with the reason, or done — so the thread never
 * claims work is happening after it has finished.
 */
interface Note {
  id: string
  afterRequestId: string | null
  role: "user" | "model"
  text: string
  /** Set on a note whose words follow a moment's re-cut. */
  reclipOf?: string
}

/** The product's own verbs for this: on their own they mean the moment on screen. */
const RECLIP_VERBS = /\b(re-?clip|re-?cut|recut)\b/i
const REWORK_WORDS = /\b(redo|rework|try (that|it|this) again)\b/i
const EDIT_WORDS = /\b(trim|shorten|tighten|tighter|punchier|edit|zoom|crop|slower|faster|change|cut|caption|captions|remove)\b/i
const THIS_ONE = /\b(this|it|that|this one|the clip|the moment|the cut)\b/i
/** A message that opens like a question about the footage is one, whatever verbs follow. */
const SEARCH_OPENERS = /^\s*(find|show|search|look for|clip every|every time|where|when)\b/i

/**
 * Whether a message is about the moment on screen rather than a search.
 * "cut every time the crowd cheers" and "find when they redo the kitchen"
 * are searches; "tighten this one", "redo it" and "re-cut" are edits. An
 * edit word alone is not enough — it must point at the clip, or be the
 * product's own word for a re-cut — because an edit spends one of the
 * moment's few re-cuts, and a search sent there never happens.
 */
export function isEditRequest(text: string): boolean {
  if (SEARCH_OPENERS.test(text) && !RECLIP_VERBS.test(text)) return false
  return RECLIP_VERBS.test(text) || ((REWORK_WORDS.test(text) || EDIT_WORDS.test(text)) && THIS_ONE.test(text))
}

function DialogueIllustration() {
  return (
    <svg width="132" height="108" viewBox="0 0 132 108" fill="none" aria-hidden className="text-foreground">
      <rect x="14" y="2" width="34" height="20" rx="6" className="stroke-border" strokeWidth="1.5" />
      <rect x="10" y="30" width="42" height="48" rx="8" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="86" width="34" height="20" rx="6" className="stroke-border" strokeWidth="1.5" />
      <line x1="72" y1="42" x2="122" y2="42" className="stroke-border" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="72" y1="54" x2="108" y2="54" className="stroke-border" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="79" cy="72" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M79 75v-6m0 0-2.4 2.4M79 69l2.4 2.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DialogueEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center" data-testid="dialogue-empty">
      <DialogueIllustration />
      <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Talk to your footage — &ldquo;find the part where the car pulls out&rdquo;, or &ldquo;re-cut this one&rdquo;. New moments land in
        the feed; a re-cut reworks the clip on screen.
      </p>
    </div>
  )
}

function UserLine({ text }: { text: string }) {
  return (
    <p className="ml-auto max-w-5/6 text-right text-sm font-medium leading-relaxed text-foreground" data-testid="dialogue-user">
      {text}
    </p>
  )
}

function ModelLine({ text, children }: { text?: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-5/6 text-sm leading-relaxed text-muted-foreground" data-testid="dialogue-model">
      {text}
      {children}
    </div>
  )
}

const isSearching = (exchange: Exchange) => exchange.request.status === "pending" || exchange.request.status === "searching"

/**
 * What the system says about one question once it has answered.
 *
 * The FIRST question was asked on the upload step, not here, so it is not
 * conversation: for it, only what must be admitted is said — the whole
 * video was not read, a stretch could not be looked at, moments were seen
 * but not trusted, nothing was found. When that first answer is clean and
 * complete and has moments, nothing is said at all: the cards speak (the
 * owner's rule from the theater), and the dialogue opens on its empty
 * state. A follow-up question, asked here, gets its full answer.
 */
export function exchangeLines(exchange: Exchange, readThroughSeconds: number | null | undefined, first: boolean): string[] {
  const { request } = exchange
  if (isSearching(exchange)) return []
  const count = request.matches?.length ?? 0
  const partial = request.coverage?.gaps?.some((gap) => gap.reason === "not_read_yet") ?? false
  const speakUp = !first || request.status === "failed" || count === 0 || partial
  return [speakUp ? answerLine(request, readThroughSeconds) : null, coverageLine(request), uncertainLine(request)].filter(
    (line): line is string => typeof line === "string" && line.length > 0,
  )
}

function ExchangeLines({ exchange, readThroughSeconds, first }: { exchange: Exchange; readThroughSeconds: number | null | undefined; first: boolean }) {
  const { request } = exchange
  if (isSearching(exchange)) {
    return (
      <ModelLine>
        <TextShimmer as="span">Looking through your video…</TextShimmer>
        {request.progress?.message && <span className="mt-1 block text-xs">{request.progress.message}</span>}
      </ModelLine>
    )
  }
  return (
    <>
      {exchangeLines(exchange, readThroughSeconds, first).map((line, index) => (
        <ModelLine key={`${request.id}-${index}`} text={line} />
      ))}
    </>
  )
}

/**
 * Whether an ask was taken. `false` means it was not — the page has shown
 * why — and the words stay in the box to edit and send again. Anything
 * else counts as taken.
 */
export type AskOutcome = boolean | void

/** The question box: one line, sent with Enter or the arrow. */
export function AskBar({
  onAsk,
  disabled,
  placeholder,
}: {
  onAsk: (text: string) => AskOutcome | Promise<AskOutcome>
  disabled: boolean
  placeholder: string
}) {
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const trimmed = draft.trim()
  const canSend = trimmed !== "" && !pending && !disabled

  const send = async () => {
    if (!canSend) return
    setPending(true)
    try {
      // The words leave the box only once the ask was taken: a question
      // the server refused is still the person's question, and clearing it
      // would make them type it again to retry.
      const outcome = await onAsk(trimmed)
      if (outcome !== false) setDraft("")
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
      className="mt-5 flex items-center gap-2"
    >
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={disabled || pending}
        placeholder={placeholder}
        aria-label="Ask for a moment"
        className="h-10 min-w-0 flex-1 border-b border-border bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition hover:border-foreground",
          !canSend && "opacity-40",
        )}
      >
        <ArrowUp aria-hidden size={16} />
      </button>
    </form>
  )
}

export interface DialogueProps {
  exchanges: Exchange[]
  video: Video | null
  /** Every moment in the feed, so a note about a re-cut can say where it got to. */
  moments: FeedMoment[]
  /** The moment on screen — what an edit refers to. */
  active: FeedMoment | undefined
  /** A search is still running; another cannot start until it finishes. */
  searching: boolean
  /** Returns false when the question could not be sent; it stays in the box. */
  onAsk: (instruction: string) => AskOutcome | Promise<AskOutcome>
  /** Returns false when the re-cut did not start; the dialogue says so instead of claiming it did. */
  onReclip: (moment: FeedMoment) => boolean | void | Promise<boolean | void>
}

/** What a re-cut note says right now, from the moment itself. */
function reclipNoteText(moments: FeedMoment[], matchId: string, fallback: string): string {
  const moment = moments.find((candidate) => candidate.match.id === matchId)
  if (!moment) return fallback
  const title = moment.match.description || "this moment"
  if (moment.reworking) {
    return `Re-cutting "${title}". I can't follow written edit instructions yet, so this is the same moment cut again from the footage around it — not the change you described.`
  }
  if (moment.match.reclipStatus === "failed") {
    return `The re-cut of "${title}" didn't work: ${moment.match.reclipError ?? "nothing changed."}`
  }
  return `Re-cut "${title}" — same moment, new cut. It's on the card now.`
}

export function Dialogue({ exchanges, video, moments, active, searching, onAsk, onReclip }: DialogueProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const threadRef = useRef<HTMLDivElement>(null)
  const readThroughSeconds = video?.index?.readThroughSeconds

  const addNote = (role: Note["role"], text: string, reclipOf?: string) =>
    setNotes((previous) => [
      ...previous,
      { id: `note-${previous.length}-${Date.now()}`, afterRequestId: exchanges.at(-1)?.request.id ?? null, role, text, ...(reclipOf ? { reclipOf } : {}) },
    ])
  const noteText = (note: Note) => (note.reclipOf ? reclipNoteText(moments, note.reclipOf, note.text) : note.text)

  // Nothing said yet: no follow-up question, no note, and a first answer
  // with nothing to admit. That is the empty state — the cards speak.
  const first = exchanges[0]
  const firstSpeaks = first !== undefined && (isSearching(first) || exchangeLines(first, readThroughSeconds, true).length > 0)
  const entryCount = (firstSpeaks ? 1 : 0) + Math.max(0, exchanges.length - 1) + notes.length
  useEffect(() => {
    const element = threadRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [entryCount])

  const handleAsk = async (text: string): Promise<AskOutcome> => {
    if (isEditRequest(text)) {
      addNote("user", text)
      const title = active?.match.description || "this moment"
      if (!active) {
        addNote("model", "There's no moment on screen to re-cut. Ask for one first.")
        return true
      }
      if (active.reworking) {
        addNote("model", `Already reworking "${title}".`)
        return true
      }
      if ((active.match.reclipsRemaining ?? 0) <= 0) {
        addNote("model", `"${title}" has used all its re-cuts.`)
        return true
      }
      // The note follows the result: a re-cut the server refused must not
      // sit in the thread as one that is underway — and one that started
      // keeps following the moment, to "done" or to "didn't work".
      const started = await onReclip(active)
      if (started === false) {
        addNote("model", `"${title}" could not be re-cut just now — nothing changed. The message above says why.`)
      } else {
        addNote("model", `Re-cut requested for "${title}".`, active.match.id)
      }
      return true
    }
    return onAsk(text)
  }

  const ready = video?.readyForSearch === true
  const placeholder = searching ? "Still looking…" : ready ? "Ask for a moment…" : "Your video is still being prepared…"
  const notesAfter = (requestId: string | null) => notes.filter((note) => note.afterRequestId === requestId)

  return (
    <div className="flex min-h-80 min-w-64 flex-1 flex-col" data-testid="dialogue">
      <div ref={threadRef} className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {entryCount === 0 && <DialogueEmpty />}
        {notesAfter(null).map((note) => (note.role === "user" ? <UserLine key={note.id} text={note.text} /> : <ModelLine key={note.id} text={noteText(note)} />))}
        {exchanges.map((exchange, index) => (
          <div key={exchange.request.id} className="flex flex-col gap-4">
            {/* The first question was asked on the upload step; only its caveats belong here. */}
            {index > 0 && <UserLine text={exchange.request.instruction} />}
            <ExchangeLines exchange={exchange} readThroughSeconds={readThroughSeconds} first={index === 0} />
            {notesAfter(exchange.request.id).map((note) =>
              note.role === "user" ? <UserLine key={note.id} text={note.text} /> : <ModelLine key={note.id} text={noteText(note)} />,
            )}
          </div>
        ))}
      </div>
      <AskBar onAsk={handleAsk} disabled={searching || !ready} placeholder={placeholder} />
    </div>
  )
}
