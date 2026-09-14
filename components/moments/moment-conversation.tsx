"use client"

import { useRef, useState } from "react"
import { ArrowLeft, Download, RotateCcw } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Button, buttonVariants } from "@/components/space/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/space/tooltip"
import { acknowledgeLine, candidatesLine, progressLine } from "@/components/start/answer-words"
import { askGate } from "@/components/start/ask-gate"
import { isEditRequest, isSearching, reclipNoteText, referencedIndex, sourceWords } from "@/components/start/conversation"
import { evidenceWords, formatRange, momentTitle, type FeedMoment } from "@/components/start/moments"
import { StreamedText } from "@/components/start/streamed-text"
import type { Exchange } from "@/components/start/types"
import type { ChatSignal, Video } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Answer, answerActionClass } from "./answer"
import { AskComposer } from "./ask-composer"
import { MomentPlayer } from "./moment-player"

/**
 * One moment and the conversation about it — the third screen of the
 * owner's prototype (2026-09-14).
 *
 * The hierarchy is the page: the footage, then what Clipit understood
 * about it, then the conversation. What the search said about the whole
 * question — how many it found, what it could not look at — belongs to the
 * results page and stays there; here the answer is this moment, in the
 * search's own words, and the spoken line it heard when there was one.
 *
 * What can be DONE with the moment — re-cut it, save its file — is real
 * product behaviour and stays reachable, as small actions in the row under
 * the answer, beside copy and the thumbs; not as the architecture of the
 * screen (the owner, 2026-09-14). Whether it was kept, and how its file is
 * getting on, is on the picture, where the player says so.
 *
 * Words that ask for THIS moment to be reworked — "tighten this one",
 * "re-cut it" — go to Re-clip; a question is a new search, and the page
 * takes it to that search's results. The result set itself is navigated
 * from the results page, never from here.
 *
 * One honesty rule sits in the middle of that, carried over from the
 * dialogue: the system cannot yet follow the WORDS of an edit. A re-cut
 * re-reads the footage around the moment for a better standalone cut; it
 * does not trim an intro because it was asked to. So the thread says
 * exactly that when it takes an edit, rather than letting "trim the slow
 * intro" look obeyed.
 */

interface Note {
  id: string
  role: "user" | "model"
  text: string
  /** Set on a note whose words follow a moment's re-cut. */
  reclipOf?: string
}

/** Whether an ask was taken. `false` means it was not — the page has shown why — and the words stay in the box. */
export type AskOutcome = boolean | void

export interface MomentConversationProps {
  moment: FeedMoment
  /** The question the moment answers, and what it produced. */
  exchange: Exchange
  video: Video | null
  /** Every moment of that question, in stage order, so "moment 2" means the second card. */
  moments: FeedMoment[]
  /** Whether the question was a follow-up to another of this video. */
  followUp: boolean
  /** A search is running on this video; another cannot start until it finishes. */
  searching: boolean
  /** Where the results page is, for the way back. */
  backHref: string
  onBack: () => void
  /** Returns false when the question could not be sent; it stays in the box. */
  onAsk: (instruction: string) => AskOutcome | Promise<AskOutcome>
  /** Returns false when the re-cut did not start; the thread says so instead of claiming it did. */
  onReclip: (moment: FeedMoment) => boolean | void | Promise<boolean | void>
  /** Records what someone thought of the answer. Rejecting means it was not stored. Without it there are no thumbs. */
  onRateAnswer?: (requestId: string, event: ChatSignal) => Promise<unknown>
  muted: boolean
  onMutedChange: (muted: boolean) => void
}

export function MomentConversation({
  moment,
  exchange,
  video,
  moments,
  followUp,
  searching,
  backHref,
  onBack,
  onAsk,
  onReclip,
  onRateAnswer,
  muted,
  onMutedChange,
}: MomentConversationProps) {
  const { request } = exchange
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)

  const addNote = (role: Note["role"], text: string, reclipOf?: string) =>
    setNotes((previous) => [...previous, { id: `note-${previous.length}-${Date.now()}`, role, text, ...(reclipOf ? { reclipOf } : {}) }])
  const noteText = (note: Note) => (note.reclipOf ? reclipNoteText(moments, note.reclipOf, note.text) : note.text)

  const reclip = async (target: FeedMoment) => {
    const name = target.match.description || "this moment"
    if (target.reworking) {
      addNote("model", `Already reworking "${name}".`)
      return
    }
    if ((target.match.reclipsRemaining ?? 0) <= 0) {
      addNote("model", `"${name}" has used all its re-cuts.`)
      return
    }
    // The note follows the result: a re-cut the server refused must not
    // sit in the thread as one that is underway — and one that started
    // keeps following the moment, to "done" or to "didn't work".
    const started = await onReclip(target)
    if (started === false) {
      addNote("model", `"${name}" could not be re-cut just now — nothing changed. The message above says why.`)
    } else {
      addNote("model", `Re-cut requested for "${name}".`, target.match.id)
    }
  }

  const handleAsk = async (text: string): Promise<AskOutcome> => {
    if (isEditRequest(text)) {
      addNote("user", text)
      // A moment named by number is that moment; otherwise the one on screen.
      const referenced = referencedIndex(text)
      const target = referenced === null ? moment : moments[referenced]
      if (!target) {
        addNote("model", `There's no moment ${referenced! + 1} here — ${moments.length === 1 ? "there's one" : `there are ${moments.length}`}.`)
        return true
      }
      await reclip(target)
      return true
    }
    return onAsk(text)
  }

  const submit = async (value: string) => {
    if (pending) return
    setPending(true)
    try {
      // The words leave the box only once the ask was taken: a question
      // the server refused is still the person's question, and clearing it
      // would make them type it again to retry.
      const outcome = await handleAsk(value)
      if (outcome === false) box.current?.focus()
      else setDraft("")
    } finally {
      setPending(false)
    }
  }

  const gate = askGate(video)
  const disabled = searching || !gate.accepting
  const placeholder = searching ? "Still looking…" : (gate.placeholder ?? "Ask about this moment…")

  const running = isSearching(exchange)
  const from = sourceWords(request)
  const canReclip = !moment.reworking && (moment.match.reclipsRemaining ?? 0) > 0 && !running
  const saveable = moment.production === "produced" && moment.downloadUrl ? moment.downloadUrl : null

  return (
    <div data-testid="moment-conversation">
      <a
        href={backHref}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
          event.preventDefault()
          onBack()
        }}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-1.5 mb-2.5 font-normal text-muted-foreground hover:text-foreground")}
      >
        <ArrowLeft className="size-3.5" />
        All moments
      </a>

      <div className="flex items-start gap-12 max-[860px]:flex-col max-[860px]:gap-5">
        <div className="shrink-0 max-[860px]:order-2 max-[860px]:self-center">
          <MomentPlayer key={moment.match.id} moment={moment} video={video} muted={muted} onMutedChange={onMutedChange} />
        </div>

        <section className="flex min-w-0 max-w-[520px] flex-1 flex-col pt-0.5 max-[860px]:contents" aria-label="Conversation about this moment">
          <p className="mb-[18px] text-[15px] leading-normal font-medium tracking-[-0.005em] text-foreground max-[860px]:order-1" data-testid="conversation-question">
            {request.instruction}
          </p>

          <div className="flex flex-col gap-6 max-[860px]:order-3" data-testid="conversation-thread">
            {running ? (
              <div className="text-[15px] leading-[1.7] text-foreground/85">
                <p>
                  <StreamedText text={acknowledgeLine(request.instruction, followUp)} />
                </p>
                <TextShimmer as="p" className="mt-2 text-sm">
                  {progressLine(request, video)}
                </TextShimmer>
                {candidatesLine(request) && <p className="mt-1 text-sm text-muted-foreground">{candidatesLine(request)}</p>}
              </div>
            ) : (
              <Answer
                text={momentTitle(moment.match)}
                quote={moment.match.quote}
                requestId={request.status === "completed" ? request.id : undefined}
                onRate={onRateAnswer}
                metadata={
                  <>
                    <span className="tabular-nums">{formatRange(moment.match)}</span>
                    <span className="opacity-70">· {evidenceWords(moment.match)}</span>
                    {from && <span className="opacity-70">· {from}</span>}
                  </>
                }
                actions={
                  <>
                    {canReclip && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Re-cut this moment"
                              data-testid="action-reclip"
                              onClick={() => void submit("re-cut this one")}
                              className={answerActionClass}
                            />
                          }
                        >
                          <RotateCcw className="size-[12.5px]" />
                        </TooltipTrigger>
                        <TooltipContent>Re-cut this moment</TooltipContent>
                      </Tooltip>
                    )}
                    {saveable && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <a
                              href={saveable}
                              download
                              aria-label="Download — save this clip"
                              data-testid="action-download"
                              className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }), answerActionClass)}
                            />
                          }
                        >
                          <Download className="size-[12.5px]" />
                        </TooltipTrigger>
                        <TooltipContent>Download the clip</TooltipContent>
                      </Tooltip>
                    )}
                  </>
                }
              />
            )}

            {notes.map((note) =>
              note.role === "user" ? (
                <p key={note.id} className="text-sm leading-normal text-foreground" data-testid="conversation-user">
                  {note.text}
                </p>
              ) : (
                <p key={note.id} className="text-sm leading-relaxed text-muted-foreground" data-testid="conversation-model">
                  {noteText(note)}
                </p>
              ),
            )}
          </div>

          <div className="mt-7 max-[860px]:order-4">
            <AskComposer
              size="thread"
              value={draft}
              onChange={setDraft}
              onSubmit={(value) => void submit(value)}
              placeholder={placeholder}
              label="Ask about this moment"
              sendLabel="Send"
              disabled={disabled || pending}
              textareaRef={box}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
