"use client"

import { useState, type ReactNode } from "react"
import { Copy, ThumbsDown, ThumbsUp } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/space/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/space/tooltip"
import { StreamedText } from "@/components/start/streamed-text"
import type { ChatSignal } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * The answer about the selected moment, in the owner's prototype's shape
 * (2026-09-14): the words, one quiet line of where they come from, the
 * actions that belong to an answer, and a few follow-ups.
 *
 * The words are ours and their honesty rules are unchanged: every line is
 * one the search itself said — the count it finished with, a stretch it
 * could not look at, a moment it was unsure of. Nothing here is written to
 * sound like an answer.
 */

/**
 * Two thumbs under an answer: was this what you were looking for?
 *
 * It rates the ANSWER — the model's words about your footage — and decides
 * nothing about a moment. There is no undo, so none is offered: the server
 * keeps these as a log of what people did, one row per press, and cannot
 * withdraw a row. Pressing the same thumb twice does nothing the second
 * time; changing your mind sends the other thumb, and both presses are
 * then in the log, in order, which is the honest record.
 *
 * What is drawn is what the server took. The thumb fills while the press
 * is in the air, because you did press it; if the send fails it empties
 * again and says so, rather than leaving a filled thumb standing for a
 * rating nobody has.
 */
const THUMBS = [
  { event: "answer_helpful", icon: ThumbsUp, label: "Good answer" },
  { event: "answer_incorrect", icon: ThumbsDown, label: "Not what I was after" },
] as const satisfies ReadonlyArray<{ event: ChatSignal; icon: unknown; label: string }>

export function AnswerRating({ requestId, onRate }: { requestId: string; onRate: (requestId: string, event: ChatSignal) => Promise<unknown> }) {
  /** What the server has taken for this answer, as far as this page knows. */
  const [rated, setRated] = useState<ChatSignal | null>(null)
  /** The press in the air, drawn as chosen until it lands or fails. */
  const [sending, setSending] = useState<ChatSignal | null>(null)
  const chosen = sending ?? rated

  return (
    <span className="flex items-center gap-0.5" data-testid="answer-rating">
      {THUMBS.map(({ event, icon: Icon, label }) => {
        const isChosen = chosen === event
        // The label says what pressing DOES, and once it is pressed it says
        // what it did — a screen reader on a filled thumb should not still
        // be offered the action it already took.
        const said = isChosen ? `${label} — sent` : label
        return (
          <Tooltip key={event}>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={said}
                  aria-pressed={isChosen}
                  // Only while a press is in the air. The chosen thumb stays
                  // at full strength and simply does nothing when pressed
                  // again, the way a chosen option does — dimming it would
                  // draw the one you picked fainter than the one you did not.
                  disabled={sending !== null && !isChosen}
                  onClick={async () => {
                    // Pressing the same thumb again is the same opinion, not
                    // a second one. The log is evidence and must not read as
                    // two people liking the answer.
                    if (isChosen || sending !== null) return
                    setSending(event)
                    try {
                      await onRate(requestId, event)
                      setRated(event)
                    } catch {
                      // Nothing was stored, so nothing is drawn. The message
                      // is transient because the failure is.
                      toast.error("Couldn't send that. Try again in a moment.")
                    } finally {
                      setSending(null)
                    }
                  }}
                  className={cn("size-[22px] text-muted-foreground hover:text-foreground pointer-coarse:size-11", isChosen && "text-foreground")}
                />
              }
            >
              <Icon className="size-[12.5px]" fill={isChosen ? "currentColor" : "none"} />
            </TooltipTrigger>
            <TooltipContent>{said}</TooltipContent>
          </Tooltip>
        )
      })}
    </span>
  )
}

export interface AnswerProps {
  /** What the search said, line by line. */
  lines: string[]
  /** Words arrive one after another, the way an answer does when someone is telling you. */
  streamed?: boolean
  /** The quiet line under the words: where the moment sits, how it was found. */
  metadata?: ReactNode
  /** The question whose answer this is, for the thumbs; without it there are no thumbs. */
  requestId?: string
  onRate?: (requestId: string, event: ChatSignal) => Promise<unknown>
  /** Things to do next, as chips. Each is a real action, not a suggestion. */
  followUps?: ReactNode
  className?: string
}

export function Answer({ lines, streamed = true, metadata, requestId, onRate, followUps, className }: AnswerProps) {
  const text = lines.join(" ")
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied")
    } catch {
      toast.error("Couldn't copy that.")
    }
  }

  return (
    <div className={cn("group/answer", className)} data-testid="answer">
      <p className="text-[15px] leading-[1.7] text-foreground/85" data-testid="answer-words">
        {lines.map((line, index) => (
          <span key={`${index}-${line}`}>
            {index > 0 ? " " : null}
            {streamed ? <StreamedText text={line} /> : line}
          </span>
        ))}
      </p>

      <div className="mt-3.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-baseline gap-1.5 truncate text-[11.5px]" data-testid="answer-metadata">
          {metadata}
        </span>
        <span className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover/answer:opacity-100 focus-within:opacity-100">
          <TooltipProvider delay={400}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy the answer"
                    onClick={() => void copy()}
                    className="size-[22px] text-muted-foreground hover:text-foreground pointer-coarse:size-11"
                  />
                }
              >
                <Copy className="size-[12.5px]" />
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
            {requestId && onRate && <AnswerRating requestId={requestId} onRate={onRate} />}
          </TooltipProvider>
        </span>
      </div>

      {followUps && <div className="mt-[18px] flex flex-wrap gap-1.5">{followUps}</div>}
    </div>
  )
}

/** A follow-up chip's look, for a link that is one (the file to save). */
export const followUpClass = cn(
  buttonVariants({ variant: "ghost", size: "xs" }),
  "rounded-full bg-foreground/[0.035] font-normal text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground/80",
)

/** A follow-up chip: one real thing to do next. */
export function FollowUp({ children, className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" size="xs" {...props} className={cn(followUpClass, className)}>
      {children}
    </Button>
  )
}
