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

/** A word the dialogue adds itself — a Re-clip taken, or refused. Placed after the question it followed. */
interface Note {
  id: string
  afterRequestId: string | null
  role: "user" | "model"
  text: string
}

const REWORK_WORDS = /\b(re-?clip|re-?cut|recut|redo|rework|try (that|it|this) again)\b/i
const EDIT_WORDS = /\b(trim|shorten|tighten|tighter|punchier|edit|zoom|crop|slower|faster|change|cut|caption|captions|remove)\b/i
const THIS_ONE = /\b(this|it|that|this one|the clip|the moment|the cut)\b/i

/**
 * Whether a message is about the moment on screen rather than a search.
 * "cut every time the crowd cheers" is a search; "tighten this one" and
 * "re-cut it" are edits. An edit word alone is not enough — it must point
 * at the clip — so a search that happens to say "cut" still searches.
 */
export function isEditRequest(text: string): boolean {
  return REWORK_WORDS.test(text) || (EDIT_WORDS.test(text) && THIS_ONE.test(text))
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

/** What the system says about one question, at whatever stage it is. */
function ExchangeLines({ exchange, readThroughSeconds }: { exchange: Exchange; readThroughSeconds: number | null | undefined }) {
  const { request } = exchange
  if (request.status === "pending" || request.status === "searching") {
    return (
      <ModelLine>
        <TextShimmer as="span">Looking through your video…</TextShimmer>
        {request.progress?.message && <span className="mt-1 block text-xs">{request.progress.message}</span>}
      </ModelLine>
    )
  }
  const lines = [answerLine(request, readThroughSeconds), coverageLine(request), uncertainLine(request)].filter(
    (line): line is string => typeof line === "string" && line.length > 0,
  )
  return (
    <>
      {lines.map((line, index) => (
        <ModelLine key={`${request.id}-${index}`} text={line} />
      ))}
    </>
  )
}

/** The question box: one line, sent with Enter or the arrow. */
export function AskBar({
  onAsk,
  disabled,
  placeholder,
}: {
  onAsk: (text: string) => void | Promise<void>
  disabled: boolean
  placeholder: string
}) {
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const trimmed = draft.trim()
  const canSend = trimmed !== "" && !pending && !disabled

  const send = async () => {
    if (!canSend) return
    setDraft("")
    setPending(true)
    try {
      await onAsk(trimmed)
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
        disabled={disabled}
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
  /** The moment on screen — what an edit refers to. */
  active: FeedMoment | undefined
  /** A search is still running; another cannot start until it finishes. */
  searching: boolean
  onAsk: (instruction: string) => void | Promise<void>
  onReclip: (moment: FeedMoment) => void
}

export function Dialogue({ exchanges, video, active, searching, onAsk, onReclip }: DialogueProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const threadRef = useRef<HTMLDivElement>(null)
  const readThroughSeconds = video?.index?.readThroughSeconds

  const addNote = (role: Note["role"], text: string) =>
    setNotes((previous) => [
      ...previous,
      { id: `note-${previous.length}-${Date.now()}`, afterRequestId: exchanges.at(-1)?.request.id ?? null, role, text },
    ])

  const entryCount = exchanges.length + notes.length
  useEffect(() => {
    const element = threadRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [entryCount])

  const handleAsk = async (text: string) => {
    if (isEditRequest(text)) {
      addNote("user", text)
      const title = active?.match.description || "this moment"
      if (!active) {
        addNote("model", "There's no moment on screen to re-cut. Ask for one first.")
        return
      }
      if (active.reworking) {
        addNote("model", `Already reworking "${title}".`)
        return
      }
      if ((active.match.reclipsRemaining ?? 0) <= 0) {
        addNote("model", `"${title}" has used all its re-cuts.`)
        return
      }
      onReclip(active)
      addNote(
        "model",
        `Re-cutting "${title}". I can't follow written edit instructions yet, so this is the same moment cut again from the footage around it — not the change you described.`,
      )
      return
    }
    await onAsk(text)
  }

  const ready = video?.readyForSearch === true
  const placeholder = searching ? "Still looking…" : ready ? "Ask for a moment…" : "Your video is still being prepared…"
  const notesAfter = (requestId: string | null) => notes.filter((note) => note.afterRequestId === requestId)

  return (
    <div className="flex min-h-80 min-w-64 flex-1 flex-col" data-testid="dialogue">
      <div ref={threadRef} className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {entryCount === 0 && <DialogueEmpty />}
        {notesAfter(null).map((note) => (note.role === "user" ? <UserLine key={note.id} text={note.text} /> : <ModelLine key={note.id} text={note.text} />))}
        {exchanges.map((exchange) => (
          <div key={exchange.request.id} className="flex flex-col gap-4">
            <UserLine text={exchange.request.instruction} />
            <ExchangeLines exchange={exchange} readThroughSeconds={readThroughSeconds} />
            {notesAfter(exchange.request.id).map((note) =>
              note.role === "user" ? <UserLine key={note.id} text={note.text} /> : <ModelLine key={note.id} text={note.text} />,
            )}
          </div>
        ))}
      </div>
      <AskBar onAsk={handleAsk} disabled={searching || !ready} placeholder={placeholder} />
    </div>
  )
}
