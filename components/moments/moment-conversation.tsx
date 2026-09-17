"use client"

import { useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { motion } from "motion/react"
import { TextShimmer } from "@/components/loading-ui/text-shimmer"
import { buttonVariants } from "@/components/space/button"
import { acknowledgeLine, candidatesLine, progressLine } from "@/components/start/answer-words"
import { askAboutVideoGate } from "@/components/start/ask-gate"
import { isSearching } from "@/components/start/conversation"
import { evidenceWords, formatRange, momentTitle, type FeedMoment } from "@/components/start/moments"
import { StreamedText } from "@/components/start/streamed-text"
import type { Exchange } from "@/components/start/types"
import type { ChatSignal, Video } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Answer } from "./answer"
import { AskComposer } from "./ask-composer"
import { MatchBadge } from "./match-badge"
import { MomentPlayer } from "./moment-player"

interface Note {
  id: string
  role: "user" | "model"
  text: string
}

export type AskOutcome = boolean | void

export interface MomentConversationProps {
  moment: FeedMoment
  exchange: Exchange
  video: Video | null
  moments: FeedMoment[]
  followUp: boolean
  searching: boolean
  backHref: string
  onBack: () => void
  onAsk: (instruction: string) => AskOutcome | Promise<AskOutcome>
  onReclip: (moment: FeedMoment) => boolean | void | Promise<boolean | void>
  onRateAnswer?: (requestId: string, event: ChatSignal) => Promise<unknown>
  muted: boolean
  onMutedChange: (muted: boolean) => void
}

export function MomentConversation({
  moment,
  exchange,
  video,
  followUp,
  searching,
  backHref,
  onBack,
  onAsk,
  onRateAnswer,
  muted,
  onMutedChange,
}: MomentConversationProps) {
  const { request } = exchange
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)

  const submit = async (value: string) => {
    if (pending) return
    setPending(true)
    setNotes((previous) => [...previous, { id: `user-${Date.now()}`, role: "user", text: value }])
    try {
      const outcome = await onAsk(value)
      if (outcome === false) {
        box.current?.focus()
        setNotes((previous) => [...previous, { id: `model-${Date.now()}`, role: "model", text: "That question could not be sent. Try again." }])
      } else {
        setDraft("")
      }
    } finally {
      setPending(false)
    }
  }

  const gate = askAboutVideoGate(video)
  const disabled = searching || !gate.accepting
  const placeholder = searching ? "Still looking…" : (gate.placeholder ?? "Ask about this moment…")
  const running = isSearching(exchange)
  const percent = Math.round(moment.match.confidence * 100)

  return (
    <div className="w-full px-4 pb-6 sm:px-6" data-testid="moment-conversation">
      <div className="mx-auto w-full max-w-[1260px]">
        <a
          href={backHref}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
            event.preventDefault()
            onBack()
          }}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3 -ml-2 rounded-full font-normal text-[#718197] hover:bg-white hover:text-[#26374a]")}
        >
          <ArrowLeft className="size-3.5" />
          All moments
        </a>

        <div className="grid min-h-[calc(100dvh-110px)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-[#e1eaf3] bg-white/70 p-4 shadow-[0_20px_60px_rgba(70,104,140,0.08)] sm:p-7"
          >
            <div className="relative w-full max-w-[760px] overflow-hidden rounded-[22px] bg-neutral-950 shadow-[0_24px_70px_rgba(23,45,67,0.18)]">
              <div className="aspect-[4/3] w-full">
                <MomentPlayer key={moment.match.id} moment={moment} video={video} muted={muted} onMutedChange={onMutedChange} />
              </div>
              <MatchBadge value={percent} className="absolute top-3 left-3" />
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28 }}
            className="flex min-h-[520px] flex-col overflow-hidden rounded-[28px] border border-[#e1eaf3] bg-white shadow-[0_20px_60px_rgba(70,104,140,0.08)]"
            aria-label="Conversation about this moment"
          >
            <div className="border-b border-[#edf2f7] px-5 py-4">
              <p className="text-[11px] font-medium tracking-[0.12em] text-[#8b9bad] uppercase">Moment chat</p>
              <p className="mt-2 line-clamp-2 text-[15px] font-medium leading-snug text-[#233449]">{request.instruction}</p>
              <p className="mt-2 text-xs text-[#8293a5]">{formatRange(moment.match)} · {evidenceWords(moment.match)}</p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5" data-testid="conversation-thread">
              {running ? (
                <div className="text-[14px] leading-relaxed text-[#33465a]">
                  <p><StreamedText text={acknowledgeLine(request.instruction, followUp)} /></p>
                  <TextShimmer as="p" className="mt-2 text-sm">{progressLine(request, video)}</TextShimmer>
                  {candidatesLine(request) && <p className="mt-1 text-sm text-[#8293a5]">{candidatesLine(request)}</p>}
                </div>
              ) : (
                <Answer
                  text={momentTitle(moment.match)}
                  quote={moment.match.quote}
                  requestId={request.status === "completed" ? request.id : undefined}
                  onRate={onRateAnswer}
                />
              )}

              {notes.map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    note.role === "user"
                      ? "ml-auto bg-[linear-gradient(135deg,#e0f7ff_0%,#c8eaff_55%,#d7ddff_100%)] text-[#17314a]"
                      : "mr-auto bg-[#f4f7fa] text-[#53677b]",
                  )}
                >
                  {note.text}
                </div>
              ))}
            </div>

            <div className="border-t border-[#edf2f7] p-3">
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
          </motion.aside>
        </div>
      </div>
    </div>
  )
}
