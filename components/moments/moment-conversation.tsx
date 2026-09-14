"use client"

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import { ArrowLeft, Download, RotateCcw, Volume2, VolumeX } from "lucide-react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { Button, buttonVariants } from "@/components/space/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/space/tooltip"
import { acknowledgeLine, candidatesLine, progressLine } from "@/components/start/answer-words"
import { askGate } from "@/components/start/ask-gate"
import { isEditRequest, isSearching, reclipNoteText, referencedIndex, sourceWords } from "@/components/start/conversation"
import { evidenceWords, formatRange, momentTitle, type FeedMoment } from "@/components/start/moments"
import { StreamedText } from "@/components/start/streamed-text"
import type { Exchange } from "@/components/start/types"
import { PHONE, useMediaQuery } from "@/hooks/use-media-query"
import type { ChatSignal, Video } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Answer, answerActionClass } from "./answer"
import { AskComposer } from "./ask-composer"
import { MomentPlayer } from "./moment-player"
import { TOP_ROW, cardAt, clamp, openSheetHeight } from "./stage-layout"
import { useStageFrame } from "./use-stage-frame"

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
 * On a phone the same page is a stage (the owner, 2026-09-14: chat while
 * the video plays, without interrupting it). The footage takes the room
 * above; the conversation is a sheet below it, at rest showing only the
 * question and the box, pulled up — by its handle, or with a tap — to show
 * the answer and the thread. With the sheet down the footage is the
 * player, edge to edge, filling everything between the way back and the
 * sheet; with the sheet up it is a card about half the screen wide and 3:4
 * tall, with the sound control beside it — the owner's reference
 * (2026-09-14: Instagram's comment view), whose arithmetic is
 * stage-layout.ts. Either way the picture is the 9:16 frame drawn at the
 * card's full width and centred, so a card shorter than the picture shows
 * its middle. Whatever the sheet does, the footage is the same element and
 * keeps playing; it is never re-mounted. The stage is sized to the part of
 * the screen the keyboard leaves (useStageFrame), so the box sits above
 * the keyboard and the footage above the box.
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

/** The sheet's two resting places. */
type Sheet = "peek" | "open"
/** The peek's height until it has been measured. */
const PEEK_FALLBACK = 118
/** A press that moved less than this many pixels is a tap. */
const TAP_SLOP = 6
/** A pull past this many pixels goes where it was pulling, whatever the midpoint says. */
const DECISIVE_PULL = 40

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

  // ---- The phone stage: the footage above, the conversation a sheet below.
  const phone = useMediaQuery(PHONE)
  const stageRef = useRef<HTMLDivElement>(null)
  const frame = useStageFrame(stageRef, phone)
  const [sheet, setSheet] = useState<Sheet>("peek")
  /** The sheet's live height while it is being pulled; null at rest. */
  const [pulling, setPulling] = useState<number | null>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const threadId = useId()
  const [peekHeight, setPeekHeight] = useState(PEEK_FALLBACK)
  const press = useRef<{ y: number; height: number; moved: boolean } | null>(null)
  /** Set by a pull that just ended, so a click the browser fires for it does not toggle the sheet back. */
  const swallowClick = useRef(false)

  // The peek is exactly the handle, the question and the box — measured, so
  // the sheet at rest hides nothing of them and shows nothing else.
  useEffect(() => {
    if (!phone) return
    const head = headRef.current
    const foot = footRef.current
    if (!head || !foot) return
    const measure = () => {
      const height = head.offsetHeight + foot.offsetHeight + 1 // the sheet's top border
      if (height > 1) setPeekHeight(height)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(head)
    observer.observe(foot)
    return () => observer.disconnect()
  }, [phone])

  const stageHeight = frame?.height ?? 0
  const stageWidth = frame?.width ?? 0
  const stage = { width: stageWidth, height: stageHeight }
  // Neither resting place runs past the room below the top row: a sheet
  // taller than the stage would have its bottom — the box and its send —
  // clipped away (Devin's finding on #97). The box itself has a ceiling on
  // a phone, so a long draft scrolls inside it rather than growing the peek.
  const room = stageHeight > 0 ? Math.max(0, stageHeight - TOP_ROW) : Number.POSITIVE_INFINITY
  const peek = Math.min(peekHeight, room)
  // Up, the sheet takes what the card leaves: the card's size is the
  // owner's reference, and the sheet's follows from it.
  const openHeight = stageHeight > 0 ? openSheetHeight(stage, peek) : peek
  const sheetHeight = pulling ?? (sheet === "open" ? openHeight : peek)
  /** Up, or on its way up: the thread shows. Not when the sheet cannot rise at all (the keyboard leaves no room): then it is a peek in every respect. */
  const raised = (sheet === "open" || pulling !== null) && openHeight > peek
  /** The card above the sheet — null until the stage is measured, while CSS holds the whole frame. */
  const card = stageHeight > 0 && stageWidth > 0 ? cardAt(stage, peek, openHeight, sheetHeight) : null

  // A reply nobody can see is no reply: the sheet rises to show one, and
  // the thread keeps its newest line in view. While the sheet is down the
  // thread is not drawn and has no height to scroll, so the scroll waits
  // for the sheet to be open and runs again then (Devin's finding on #97).
  const noteCount = notes.length
  useEffect(() => {
    if (phone && noteCount > 0) setSheet("open")
  }, [phone, noteCount])
  useEffect(() => {
    if (noteCount === 0 || (phone && sheet !== "open")) return
    const thread = threadRef.current
    if (thread) thread.scrollTop = thread.scrollHeight
  }, [phone, sheet, noteCount])

  const toggleSheet = () => setSheet((current) => (current === "open" ? "peek" : "open"))
  const onHandleClick = () => {
    if (swallowClick.current) return
    toggleSheet()
  }

  // The handle row is the grip: pull it up or down, or tap it. Pointer
  // events rather than touch, so a mouse on a narrow window works the same.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!phone || event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    press.current = { y: event.clientY, height: sheetHeight, moved: false }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = press.current
    if (!start) return
    const pull = start.y - event.clientY
    if (!start.moved && Math.abs(pull) < TAP_SLOP) return
    start.moved = true
    setPulling(clamp(start.height + pull, peek, openHeight))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = press.current
    if (!start) return
    press.current = null
    setPulling(null)
    if (!start.moved) {
      // A tap. The handle's own click toggles it; this is for the words beside it.
      if (!(event.target as Element).closest("button")) toggleSheet()
      return
    }
    // A pull that started on the handle may be followed by the handle's own
    // click, in browsers that fire one after a captured drag; that click
    // must not undo where the pull went (Devin's finding on #97). The flag
    // lives only until the browser's turn is over: the click, if it comes,
    // is dispatched in the same turn as this pointerup.
    swallowClick.current = true
    window.setTimeout(() => {
      swallowClick.current = false
    }, 0)
    const pull = start.y - event.clientY
    const height = clamp(start.height + pull, peek, openHeight)
    const midway = (peek + openHeight) / 2
    setSheet(pull > DECISIVE_PULL ? "open" : pull < -DECISIVE_PULL ? "peek" : height > midway ? "open" : "peek")
  }
  const onPointerCancel = () => {
    press.current = null
    setPulling(null)
  }

  const gate = askGate(video)
  const disabled = searching || !gate.accepting
  const placeholder = searching ? "Still looking…" : (gate.placeholder ?? "Ask about this moment…")

  const running = isSearching(exchange)
  const from = sourceWords(request)
  const canReclip = !moment.reworking && (moment.match.reclipsRemaining ?? 0) > 0 && !running
  const saveable = moment.production === "produced" && moment.downloadUrl ? moment.downloadUrl : null

  const stageStyle = frame ? ({ "--stage-h": `${frame.height}px`, "--stage-shift": `${frame.shift}px` } as CSSProperties) : undefined

  return (
    <div
      ref={stageRef}
      data-testid="moment-conversation"
      style={stageStyle}
      className="max-[860px]:flex max-[860px]:h-[var(--stage-h,calc(100dvh_-_64px))] max-[860px]:translate-y-[var(--stage-shift,0px)] max-[860px]:flex-col max-[860px]:overflow-hidden max-[860px]:bg-background"
    >
      <div className="max-[860px]:flex max-[860px]:h-10 max-[860px]:shrink-0 max-[860px]:items-center max-[860px]:px-2">
        <a
          href={backHref}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
            event.preventDefault()
            onBack()
          }}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-1.5 mb-2.5 font-normal text-muted-foreground hover:text-foreground max-[860px]:m-0")}
        >
          <ArrowLeft className="size-3.5" />
          All moments
        </a>
      </div>

      <div className="flex items-start gap-12 max-[860px]:min-h-0 max-[860px]:flex-1 max-[860px]:flex-col max-[860px]:gap-0">
        <div className="relative shrink-0 max-[860px]:flex max-[860px]:min-h-0 max-[860px]:w-full max-[860px]:flex-1 max-[860px]:items-center max-[860px]:justify-center">
          {/* The card the player fills: with the sheet down, the screen's
              width and all the room there is, square to the edges; up, the
              3:4 card with its corners; between them a blend that follows
              the finger. The player draws the 9:16 picture at this width
              and clips what will not fit, so a shorter card shows the
              middle. Until the stage is measured, CSS fills the room. */}
          <div
            data-testid="footage-card"
            style={card ? { width: card.width, height: card.height, borderRadius: card.radius } : undefined}
            className={cn(
              "max-[860px]:size-full max-[860px]:overflow-hidden",
              "max-[860px]:transition-[width,height,border-radius] max-[860px]:duration-300 max-[860px]:ease-[cubic-bezier(0.32,0.72,0,1)]",
              pulling !== null && "max-[860px]:transition-none",
            )}
          >
            {/* With the sheet up the card is small and the reference keeps it
                clean: the player draws only the picture, and the sound
                control beside the card stands in for its own. */}
            <MomentPlayer key={moment.match.id} moment={moment} video={video} muted={muted} onMutedChange={onMutedChange} controls={!(phone && raised)} />
          </div>
          {phone && raised && (
            // The card shows the frame's middle, so the player's own sound
            // control is out of view; the reference puts one beside the card.
            <Button
              variant="ghost"
              size="icon"
              aria-label={muted ? "Unmute" : "Mute"}
              data-testid="card-sound"
              onClick={() => onMutedChange(!muted)}
              className="absolute right-3 bottom-2 size-10 rounded-full bg-black/60 text-white hover:bg-black/70 hover:text-white"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
          )}
        </div>

        <section
          data-testid="conversation-sheet"
          data-state={phone ? (raised ? "open" : "peek") : "wide"}
          aria-label="Conversation about this moment"
          style={phone ? { height: sheetHeight } : undefined}
          className={cn(
            "group/sheet flex min-w-0 max-w-[520px] flex-1 flex-col pt-0.5",
            "max-[860px]:w-full max-[860px]:max-w-none max-[860px]:flex-none max-[860px]:overflow-hidden max-[860px]:rounded-t-[22px] max-[860px]:border-t max-[860px]:border-shborder max-[860px]:bg-shcard max-[860px]:pt-0 max-[860px]:shadow-[0_-10px_30px_rgba(0,0,0,0.08)]",
            "max-[860px]:transition-[height] max-[860px]:duration-300 max-[860px]:ease-[cubic-bezier(0.32,0.72,0,1)]",
            pulling !== null && "max-[860px]:transition-none",
          )}
        >
          <div
            ref={headRef}
            data-testid="sheet-head"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            className="max-[860px]:cursor-grab max-[860px]:touch-none max-[860px]:select-none max-[860px]:px-4 max-[860px]:pb-2.5"
          >
            <button
              type="button"
              onClick={onHandleClick}
              aria-expanded={raised}
              aria-controls={threadId}
              aria-label={raised ? "Hide the conversation" : "Show the conversation"}
              data-testid="sheet-handle"
              className="hidden h-6 w-full items-center justify-center max-[860px]:flex"
            >
              <span aria-hidden className="h-1 w-9 rounded-full bg-foreground/20" />
            </button>
            <p
              className="mb-[18px] text-[15px] leading-normal font-medium tracking-[-0.005em] text-foreground max-[860px]:mb-0 max-[860px]:line-clamp-1"
              data-testid="conversation-question"
            >
              {request.instruction}
            </p>
          </div>

          <div
            ref={threadRef}
            id={threadId}
            className="flex flex-col gap-6 max-[860px]:hidden max-[860px]:min-h-0 max-[860px]:flex-1 max-[860px]:overflow-y-auto max-[860px]:overscroll-contain max-[860px]:px-4 max-[860px]:pt-1 max-[860px]:pb-3 max-[860px]:group-data-[state=open]/sheet:flex"
            data-testid="conversation-thread"
          >
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

          <div ref={footRef} className="mt-7 max-[860px]:mt-0 max-[860px]:px-3 max-[860px]:pt-1 max-[860px]:pb-[max(10px,env(safe-area-inset-bottom))]">
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
