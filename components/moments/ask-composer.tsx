"use client"

import type { KeyboardEvent, ReactNode, Ref } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/space/button"
import { Textarea } from "@/components/space/textarea"
import { cn } from "@/lib/utils"

/**
 * The one box a question is typed into — on home, where it is the whole
 * screen, and under a moment's conversation, where it continues it. Shadcn
 * Space's textarea and button, in the owner's prototype's two sizes
 * (2026-09-14): the wide card on home, the slimmer box in the thread.
 *
 * Controlled from outside on purpose: the composer never clears itself. A
 * question the server refused is still the person's question, and it stays
 * in the box to edit and send again; the caller empties the box only when
 * the ask was taken.
 *
 * Typing and sending are gated separately. On home you can type while a
 * video is still on its way — only the send waits for the bytes to land —
 * so `disabled` closes the whole box and `canSend` holds back the send alone.
 */
export interface AskComposerProps {
  value: string
  onChange: (value: string) => void
  /** Called with the trimmed words. */
  onSubmit: (value: string) => void
  placeholder: string
  /** The box's accessible name — what a screen reader calls it. */
  label: string
  /** Nothing here can be typed OR sent. */
  disabled?: boolean
  /** Whether SENDING is allowed, separately from typing. Leave it out to send whenever there are words. */
  canSend?: boolean
  /** The send button's accessible name: "Search" on home, "Send" in a thread. */
  sendLabel?: string
  /** Home's wide card, or the thread's box. */
  size?: "home" | "thread"
  /** Anything the box holds above the words — the attached videos on home. */
  drawer?: ReactNode
  /** Controls beside the send button — the attach control on home. */
  actions?: ReactNode
  /** True while a file is being dragged over the box; the card says so. */
  dragging?: boolean
  autoFocus?: boolean
  className?: string
  textareaRef?: Ref<HTMLTextAreaElement>
}

export function AskComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  disabled = false,
  canSend,
  sendLabel = "Send",
  size = "thread",
  drawer,
  actions,
  dragging = false,
  autoFocus = false,
  className,
  textareaRef,
}: AskComposerProps) {
  const words = value.trim()
  const sendable = words !== "" && !disabled && canSend !== false

  const submit = () => {
    if (!sendable) return
    onSubmit(words)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter is a new line, the way every chat box works.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const home = size === "home"

  return (
    <div
      data-slot="ask-composer"
      data-size={size}
      className={cn(
        "flex w-full flex-col border bg-shcard transition-[box-shadow,border-color]",
        home
          ? "rounded-[26px] p-1.5 shadow-[0_2px_24px_rgba(0,0,0,0.05)] focus-within:shadow-[0_4px_28px_rgba(0,0,0,0.09)]"
          : "rounded-[18px] p-1 shadow-[0_1px_10px_rgba(0,0,0,0.03)]",
        dragging && "border-foreground/25 shadow-[0_4px_28px_rgba(0,0,0,0.09)]",
        className,
      )}
    >
      {drawer}
      <div className={cn("flex items-end gap-1.5", !home && "w-full")}>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={label}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={1}
          className={cn(
            "resize-none border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0 disabled:bg-transparent",
            // Sixteen-pixel words on a phone: anything smaller makes Safari on
            // iOS zoom the whole page in when the box is focused, and the
            // footage with it.
            home ? "min-h-16 rounded-[20px] px-[18px] pt-4 pb-1 text-base md:text-[15px]" : "min-h-[42px] px-3 py-2.5 text-base md:text-sm",
          )}
        />
        {!home && (
          <Button
            size="icon"
            aria-label={sendLabel}
            disabled={!sendable}
            onClick={submit}
            className="m-1 size-[30px] shrink-0 rounded-full disabled:opacity-25"
          >
            <ArrowRight className="size-3.5" />
          </Button>
        )}
      </div>
      {home && (
        <div className="flex items-center justify-between gap-2 pt-1.5 pl-1.5">
          <span className="flex min-w-0 items-center gap-1">{actions}</span>
          <Button
            size="icon-lg"
            aria-label={sendLabel}
            disabled={!sendable}
            onClick={submit}
            className="shrink-0 rounded-full disabled:opacity-25"
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
