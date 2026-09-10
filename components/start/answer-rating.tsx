"use client"

import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ThumbsDownIcon, ThumbsUpIcon } from "@hugeicons/core-free-icons"
import { IconButton } from "@astryxdesign/core/IconButton"
import { HStack } from "@astryxdesign/core/HStack"
import type { ChatSignal } from "@/lib/types"

/**
 * Two thumbs under an answer: was this what you were looking for?
 *
 * The owner's ask of 2026-09-10. It rates the ANSWER — the model's words
 * about your footage — and nothing else. It is not the Keep and Skip that
 * came off the moment card in this same branch: those decided what happened
 * to a moment, and this decides nothing at all. It is a note for us about
 * whether the search was any good.
 *
 * ## There is no undo, so none is offered
 *
 * The server keeps these as a log of what people did, one row per press,
 * and has no way to withdraw a row. So pressing the same thumb twice does
 * nothing the second time, and there is no third state to return to. A
 * control that looked like a toggle would be promising an erase that cannot
 * happen.
 *
 * Changing your mind DOES send the other thumb — both presses are then in
 * the log, in order, which is the honest record of what you did.
 *
 * ## What is drawn is what the server took
 *
 * The thumb fills while the press is in the air, because you did press it.
 * If the send fails it empties again and says so, rather than leaving a
 * filled thumb standing for a rating nobody has.
 */
export interface AnswerRatingProps {
  /** The question whose answer this is. */
  requestId: string
  /** Records one press. Rejecting means it was not stored. */
  onRate: (requestId: string, event: ChatSignal) => Promise<unknown>
}

const THUMBS = [
  { event: "answer_helpful", icon: ThumbsUpIcon, label: "Good answer" },
  { event: "answer_incorrect", icon: ThumbsDownIcon, label: "Not what I was after" },
] as const satisfies ReadonlyArray<{ event: ChatSignal; icon: unknown; label: string }>

export function AnswerRating({ requestId, onRate }: AnswerRatingProps) {
  /** What the server has taken for this answer, as far as this page knows. */
  const [rated, setRated] = useState<ChatSignal | null>(null)
  /** The press in the air, drawn as chosen until it lands or fails. */
  const [sending, setSending] = useState<ChatSignal | null>(null)
  const chosen = sending ?? rated

  return (
    <HStack gap={1} data-testid="answer-rating">
      {THUMBS.map(({ event, icon, label }) => {
        const isChosen = chosen === event
        // The label says what pressing DOES, and once it is pressed it says
        // what it did — a screen reader on a filled thumb should not still
        // be offered the action it already took.
        const said = isChosen ? `${label} — sent` : label
        return (
          <IconButton
            key={event}
            label={said}
            tooltip={said}
            size="sm"
            variant={isChosen ? "secondary" : "ghost"}
            // 28px clears WCAG 2.2 SC 2.5.8 (AA) on its own — the rule wants
            // 24, and these sit 32 apart. A thumb is not a mouse pointer
            // though, so a coarse pointer gets the 44 that Apple and
            // Material both ask for, the same as the feed's dots.
            className="pointer-coarse:size-11"
            // ONLY while a press is in the air. Marking the CHOSEN one
            // disabled seemed right and drew it wrong: Astryx dims a
            // disabled button to half opacity, so the thumb you picked came
            // out fainter than the one you did not — measured at 0.5 against
            // 1.0. The eye reads that as unavailable, which is the opposite
            // of what happened. It stays at full strength and simply does
            // nothing when pressed again, the way a chosen option does.
            isDisabled={sending !== null && !isChosen}
            icon={
              <HugeiconsIcon
                icon={icon}
                className="size-4"
                // Filled once it is yours. The outline weight is the same
                // either way, so the row does not shift when you press.
                fill={isChosen ? "currentColor" : "none"}
              />
            }
            clickAction={async () => {
              // Pressing the same thumb again is the same opinion, not a
              // second one. The log is evidence and must not read as two
              // people liking the answer.
              if (isChosen || sending !== null) return
              setSending(event)
              try {
                await onRate(requestId, event)
                setRated(event)
              } catch {
                // Nothing was stored, so nothing is drawn. The message is
                // transient because the failure is: the answer is still
                // there and the thumbs are still there to press again.
                toast.error("Couldn't send that. Try again in a moment.")
              } finally {
                setSending(null)
              }
            }}
          />
        )
      })}
    </HStack>
  )
}
