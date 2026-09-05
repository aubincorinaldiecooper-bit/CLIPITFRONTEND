"use client"

import { Fragment, useRef, useState } from "react"
import {
  ChatComposer,
  ChatComposerInput,
  type ChatComposerInputHandle,
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatToolCalls,
  type ChatToolCallItem,
} from "@astryxdesign/core/Chat"
import { Heading } from "@astryxdesign/core/Heading"
import { Text } from "@astryxdesign/core/Text"
import { VStack } from "@astryxdesign/core/VStack"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import type { ClipRequest, Video } from "@/lib/types"
import { acknowledgeLine, answerLine, candidatesLine, coverageLine, productionLine, progressLine, uncertainLine } from "./answer-words"
import { askGate } from "./ask-gate"
import type { FeedMoment } from "./moment-feed"
import { StreamedText } from "./streamed-text"
import type { Exchange } from "./types"

/**
 * The dialogue beside the feed — the owner's screen of 2026-09-02, and the
 * conversation of 2026-09-05.
 *
 * Every question asked of this video, the first included, and what came of
 * it, in order. A question is acknowledged the moment it is taken; while
 * the search runs the dialogue says what it is doing, from the states the
 * server reports — the video still being prepared, the footage being
 * watched part by part, moments found so far — and its moments land in the
 * feed when the search has finished with them. Words that ask for the
 * moment ON SCREEN to be reworked — "tighten this one", "re-cut it" — go
 * to Re-clip instead of to a search.
 *
 * One honesty rule sits in the middle of that: the system cannot yet follow
 * the WORDS of an edit. A Re-clip re-reads the footage around the moment
 * for a better standalone cut; it does not trim an intro because it was
 * asked to. So the dialogue says exactly that when it takes an edit, rather
 * than letting "trim the slow intro" look obeyed.
 *
 * The thread, the bubbles and the box are Astryx's Chat components rather
 * than ours (owner's call, 2026-09-03). What that buys, beyond the look: a
 * log region screen readers announce politely, a busy flag while an answer
 * is still arriving so a reader is not read half a sentence, scrolling that
 * follows new messages with a button back to the bottom when you have
 * scrolled away, and a composer that grows with what you type. All of that
 * was either hand-rolled here or simply missing.
 *
 * What is NOT theirs, and stays ours, is every word and every rule about
 * when to say it.
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

/** "video 4", "clip 2", "moment 3", "#2", "the 4th one". */
const NUMBERED = /\b(?:video|clip|moment|number|no\.?)\s*#?\s*(\d{1,3})\b/i
const HASHED = /(?:^|\s)#(\d{1,3})\b/
const ORDINAL = /\b(\d{1,3})(?:st|nd|rd|th)\b/i

/**
 * Which moment an edit names, counted the way the feed counts — "video 4"
 * is the fourth card. Null when none is named, in which case the edit is
 * about the moment on screen. A tester on 2026-09-04 wrote "re-cut video
 * 4" from the end card and was told there was no moment on screen; there
 * were four, and she had said which.
 */
export function referencedIndex(text: string): number | null {
  const found = NUMBERED.exec(text) ?? HASHED.exec(text) ?? ORDINAL.exec(text)
  if (!found) return null
  const number = Number(found[1])
  return Number.isInteger(number) && number >= 1 ? number - 1 : null
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

/**
 * The zero state, on Astryx's ai-chat-landing pattern (owner's call,
 * 2026-09-03): a title, one line of help, and the box — centred, with the
 * conversation's weight where the conversation will be.
 *
 * Deliberately WITHOUT the template's suggestion furniture: no category
 * toggles, no grid of example prompts, no attachment drawer. Prompt chips
 * would be guesses about someone else's footage, and there is nothing to
 * attach — the video is already here, which is why there is a chat at all.
 */
function DialogueEmpty({ composer }: { composer: React.ReactNode }) {
  return (
    // Centred down the page, but NOT across it: a cross-axis centre shrinks
    // every child to its own content width, which crushes the composer into
    // a pill with its placeholder wrapping over the send button. Only the
    // words are centred; the box fills the column.
    <VStack gap={6} justify="center" height="100%" className="min-h-80 min-w-64 flex-1" data-testid="dialogue-empty">
      <VStack gap={2} align="center">
        <DialogueIllustration />
        <Heading level={3}>Talk to your footage</Heading>
        <Text type="supporting" as="p">
          &ldquo;Find the part where the car pulls out&rdquo;, or &ldquo;re-cut this one&rdquo;. New moments land in the feed; a re-cut
          reworks the clip on screen.
        </Text>
      </VStack>
      {composer}
    </VStack>
  )
}

function UserLine({ text }: { text: string }) {
  return (
    <ChatMessage sender="user">
      <ChatMessageBubble>
        <span data-testid="dialogue-user">{text}</span>
      </ChatMessageBubble>
    </ChatMessage>
  )
}

/**
 * What the system says, in a ghost bubble.
 *
 * Ghost rather than filled deliberately: these are the product's own words
 * about your footage, and the owner's screen shows them as quiet text
 * rather than a coloured slab. Ghost keeps the bubble's alignment and
 * padding without the fill.
 */
function ModelLine({ text, streamed = false, children }: { text?: string; streamed?: boolean; children?: React.ReactNode }) {
  return (
    <ChatMessage sender="assistant">
      <ChatMessageBubble variant="ghost">
        <span className="text-sm leading-relaxed text-muted-foreground" data-testid="dialogue-model">
          {text !== undefined && (streamed ? <StreamedText text={text} /> : text)}
          {children}
        </span>
      </ChatMessageBubble>
    </ChatMessage>
  )
}

const isSearching = (exchange: Exchange) => exchange.request.status === "pending" || exchange.request.status === "searching"

/**
 * The search itself, shown as the piece of work it is.
 *
 * A question here is model work: it reads the video in pieces, in one of two
 * ways, and either answers from what it already wrote down or goes back to
 * the footage. All of that was invisible before — the chat said "Looking
 * through your video…" and nothing else. This is the row you can open to see
 * what actually happened.
 *
 * It shows pieces REFUSED as well as pieces read, deliberately. A stretch the
 * model would not look at is the one thing this product must never quietly
 * swallow, and the answer's own words say it too; they should agree.
 *
 * It is NOT a running commentary on the reading. The words of an answer still
 * never narrate progress (the owner's call of 2026-09-02) — this sits beside
 * them, collapsed, for when you want to know.
 */
/** Where the answer came from, in words rather than in our field names. */
function sourceWords(request: ClipRequest): string | undefined {
  if (request.answeredFrom === "notes") return "from what I'd noted"
  if (request.answeredFrom === "footage") return "from the footage"
  if (request.resolvedMode === "visual") return "watching"
  if (request.resolvedMode === "transcript") return "listening"
  if (request.resolvedMode === "both") return "watching and listening"
  return undefined
}

function searchActivity(request: ClipRequest): ChatToolCallItem[] {
  const running = request.status === "pending" || request.status === "searching"
  const total = request.progress?.chunksTotal ?? 0
  const read = request.progress?.chunksCompleted ?? 0
  const refused = request.progress?.chunksFailed ?? 0
  return [
    {
      key: request.id,
      name: running ? "Reading your video" : "Read your video",
      status: running ? "running" : request.status === "failed" ? "error" : "complete",
      // No `target`. It would be the question, which is in the bubble
      // directly above this row — and repeating it here squeezed the row so
      // hard at the drawer's 380px that the name itself truncated to "R…".
      // One trailing item, not two. The row shrinks its own name first, and
      // at the drawer's 380px a name, a pill AND a count turned "Read your
      // video" into "R…". Said the way a person would say it, too: "notes",
      // "footage" and "visual" are our words for our own machinery.
      stats: [
        total > 0 ? `${read}/${total}${refused > 0 ? ` · ${refused} unavailable` : ""}` : null,
        // Only once it has finished. Where an answer came from is not known
        // while the search is still running, and a row that says "from what
        // I'd noted" mid-search is claiming something that has not happened.
        running ? null : sourceWords(request),
      ]
        .filter(Boolean)
        .join(" · "),
      errorMessage: request.error ?? undefined,
      // Also as detail you can open. errorMessage alone reaches a mouse
      // (tooltip) and a screen reader, and nobody on a touchscreen. This is
      // where the server's exact words live now that they are out of the
      // conversation, so they have to be reachable.
      resultDetail: request.status === "failed" ? (request.error ?? undefined) : undefined,
    },
  ]
}

function SearchActivity({ request }: { request: ClipRequest }) {
  return (
    <ChatMessage sender="assistant">
      <ChatMessageBubble variant="ghost">
        <ChatToolCalls calls={searchActivity(request)} />
      </ChatMessageBubble>
    </ChatMessage>
  )
}

/**
 * What the system says about one question once it has answered: the count
 * it finished with, a stretch that could not be looked at, moments seen but
 * not trusted, nothing found. Every question gets its answer here now — the
 * first one too, since it is asked in this conversation and acknowledged
 * in it (the owner's call of 2026-09-05, replacing the rule that the first
 * answer stayed silent and let the cards speak).
 */
export function exchangeLines(exchange: Exchange, readThroughSeconds: number | null | undefined, followUp: boolean): string[] {
  const { request } = exchange
  if (isSearching(exchange)) return []
  return [answerLine(request, readThroughSeconds, followUp), coverageLine(request), uncertainLine(request)].filter(
    (line): line is string => typeof line === "string" && line.length > 0,
  )
}

/**
 * One question's side of the conversation: the acknowledgement, the
 * activity row, and then either what the search is doing or what it found.
 *
 * Every line while the search runs is read from the request and the video
 * as the page polls them — the words change when the state does, and not
 * before. The backend's own progress string is not printed word for word:
 * it is a log line, not something anyone said (the owner's call,
 * 2026-09-03), and the exact numbers live in the activity row for anyone
 * who opens it.
 */
function ExchangeLines({ exchange, video, followUp }: { exchange: Exchange; video: Video | null; followUp: boolean }) {
  const { request } = exchange
  const acknowledgement = <ModelLine text={acknowledgeLine(request.instruction, followUp)} streamed />
  if (isSearching(exchange)) {
    const candidates = candidatesLine(request)
    return (
      <>
        {acknowledgement}
        <SearchActivity request={request} />
        <ModelLine>
          <TextShimmer as="span">{progressLine(request, video)}</TextShimmer>
        </ModelLine>
        {candidates && <ModelLine text={candidates} streamed />}
      </>
    )
  }
  const lines = exchangeLines(exchange, video?.index?.readThroughSeconds, followUp)
  return (
    <>
      {acknowledgement}
      <SearchActivity request={request} />
      {lines.map((line, index) => (
        <ModelLine key={`${request.id}-${index}`} text={line} streamed />
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
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const inputRef = useRef<ChatComposerInputHandle>(null)

  const addNote = (role: Note["role"], text: string, reclipOf?: string) =>
    setNotes((previous) => [
      ...previous,
      { id: `note-${previous.length}-${Date.now()}`, afterRequestId: exchanges.at(-1)?.request.id ?? null, role, text, ...(reclipOf ? { reclipOf } : {}) },
    ])
  const noteText = (note: Note) => (note.reclipOf ? reclipNoteText(moments, note.reclipOf, note.text) : note.text)

  // What has become of each kept moment, said after the question it came
  // from and kept current from the moment itself: "cutting", then "ready",
  // or "couldn't finish". Keep is production, and production is news.
  const kept = moments.filter((moment) => moment.decision === "kept")
  const keptAfter = (requestId: string) => kept.filter((moment) => moment.requestId === requestId)

  // Nothing said yet: no question, no note. That is the empty state.
  const entryCount = exchanges.length + notes.length + kept.length

  const handleAsk = async (text: string): Promise<AskOutcome> => {
    if (isEditRequest(text)) {
      addNote("user", text)
      // A moment named by number is that moment; otherwise the one on screen.
      const referenced = referencedIndex(text)
      const target = referenced === null ? active : moments[referenced]
      const title = target?.match.description || "this moment"
      if (referenced !== null && !target) {
        addNote("model", `There's no moment ${referenced + 1} here — ${moments.length === 1 ? "there's one" : `there are ${moments.length}`}.`)
        return true
      }
      if (!target) {
        addNote("model", "There's no moment on screen to re-cut. Scroll to one, or say which — \"re-cut moment 2\".")
        return true
      }
      if (target.reworking) {
        addNote("model", `Already reworking "${title}".`)
        return true
      }
      if ((target.match.reclipsRemaining ?? 0) <= 0) {
        addNote("model", `"${title}" has used all its re-cuts.`)
        return true
      }
      // The note follows the result: a re-cut the server refused must not
      // sit in the thread as one that is underway — and one that started
      // keeps following the moment, to "done" or to "didn't work".
      const started = await onReclip(target)
      if (started === false) {
        addNote("model", `"${title}" could not be re-cut just now — nothing changed. The message above says why.`)
      } else {
        addNote("model", `Re-cut requested for "${title}".`, target.match.id)
      }
      return true
    }
    return onAsk(text)
  }

  const gate = askGate(video)
  const disabled = searching || !gate.accepting
  const placeholder = searching ? "Still looking…" : (gate.placeholder ?? "Ask for a moment…")
  const notesAfter = (requestId: string | null) => notes.filter((note) => note.afterRequestId === requestId)

  const submit = async (value: string) => {
    const trimmed = value.trim()
    if (trimmed === "" || pending || disabled) return
    setPending(true)
    try {
      // The words leave the box only once the ask was taken: a question
      // the server refused is still the person's question, and clearing it
      // would make them type it again to retry.
      const outcome = await handleAsk(trimmed)
      if (outcome === false) {
        // Put it back, in BOTH places. The composer empties itself the moment
        // it submits — the visible box and the value it reports — and the two
        // have to agree. Restoring only the visible text is worse than not
        // restoring it: the question sits there looking ready while the send
        // button stays dead and Enter submits nothing.
        // The controlled value alone, NOT insertText. The composer only
        // notices it is non-empty when the value it is handed differs from
        // what is already in the box — and insertText had put the words
        // there first, so the two matched and it stayed "empty", leaving the
        // placeholder drawn over the restored question. Setting the value
        // against an empty box makes it write the text and drop the
        // placeholder in one go.
        setDraft(trimmed)
        inputRef.current?.focus()
      } else {
        setDraft("")
      }
    } finally {
      setPending(false)
    }
  }

  const composer = (
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={(value) => void submit(value)}
          placeholder={placeholder}
          isDisabled={disabled || pending}
          // Controlled from here, not from the composer: the composer clears
          // itself on submit, and a question the server refused is still the
          // person's question. It leaves the box only when the ask was taken.
          input={<ChatComposerInput label="Ask for a moment" maxRows={4} handleRef={inputRef} />}
        />
  )

  // Nothing said yet: the landing, with the box in the middle of the column
  // rather than docked under an empty thread.
  if (entryCount === 0) return <DialogueEmpty composer={composer} />

  return (
    // min-w-64 / min-h-80 are the old wrapper's, and they are load-bearing:
    // beside the feed's fixed 440px, a 600px window leaves this column about
    // 112px. The minimum is what makes the row wrap and put the chat BELOW
    // the feed instead of squeezing it into a strip. ChatLayout brings no
    // minimum of its own.
    <ChatLayout data-testid="dialogue" className="min-h-80 min-w-64 flex-1" composer={composer}>
      {(
        // Busy while an answer is still arriving, so a screen reader waits
        // and reads the finished sentence once instead of each fragment.
        <ChatMessageList isStreaming={exchanges.some(isSearching)}>
          {notesAfter(null).map((note) => (note.role === "user" ? <UserLine key={note.id} text={note.text} /> : <ModelLine key={note.id} text={noteText(note)} />))}
          {exchanges.map((exchange, index) => (
            <Fragment key={exchange.request.id}>
              <UserLine text={exchange.request.instruction} />
              <ExchangeLines exchange={exchange} video={video} followUp={index > 0} />
              {keptAfter(exchange.request.id).map((moment) => (
                <ModelLine key={`kept-${moment.match.id}`} text={productionLine(moment.match.description, moment.production)} streamed />
              ))}
              {notesAfter(exchange.request.id).map((note) =>
                note.role === "user" ? <UserLine key={note.id} text={note.text} /> : <ModelLine key={note.id} text={noteText(note)} />,
              )}
            </Fragment>
          ))}
        </ChatMessageList>
      )}
    </ChatLayout>
  )
}
