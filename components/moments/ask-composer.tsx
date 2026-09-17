"use client"

import type { KeyboardEvent, ReactNode, Ref } from "react"
import { ArrowUp } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/components/space/button"
import { Textarea } from "@/components/space/textarea"
import { cn } from "@/lib/utils"

export interface AskComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  placeholder: string
  label: string
  disabled?: boolean
  canSend?: boolean
  sendLabel?: string
  size?: "home" | "thread"
  drawer?: ReactNode
  actions?: ReactNode
  dragging?: boolean
  autoFocus?: boolean
  className?: string
  textareaRef?: Ref<HTMLTextAreaElement>
}

const gradient =
  "bg-[linear-gradient(135deg,#d8f6ff_0%,#a9e3ff_48%,#bfcbff_100%)] text-[#102033] shadow-[0_5px_16px_rgba(100,190,255,0.22)] hover:brightness-[0.985]"

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
  const home = size === "home"

  const submit = () => {
    if (sendable) onSubmit(words)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <motion.div
      data-slot="ask-composer"
      data-size={size}
      transition={{ duration: 0.18 }}
      className={cn(
        "flex w-full flex-col border bg-[#fbfcfd] transition-[box-shadow,border-color]",
        home
          ? "rounded-[18px] border-[#e1e5e9] p-1.5 shadow-[0_3px_12px_rgba(15,23,42,0.05)] focus-within:border-[#cbd7e2] focus-within:shadow-[0_5px_18px_rgba(15,23,42,0.07)]"
          : "rounded-[22px] border-[#dfe9f3] bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(71,111,153,0.09)] backdrop-blur-xl focus-within:border-[#b9dcf7]",
        dragging && "border-[#9ed8ff] shadow-[0_8px_24px_rgba(71,111,153,0.10)]",
        className,
      )}
    >
      {drawer}
      <div className="flex items-end gap-2">
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
            "resize-none border-0 bg-transparent text-[#172033] shadow-none placeholder:text-[#8d99a7] focus-visible:border-0 focus-visible:ring-0 disabled:bg-transparent",
            home
              ? "min-h-[52px] rounded-[14px] px-3.5 pt-3.5 pb-1.5 text-[15px] max-[860px]:text-base!"
              : "min-h-[46px] max-h-[150px] px-3 py-3 text-[14px] max-[860px]:text-base!",
          )}
        />
        {!home && (
          <motion.div whileTap={{ scale: 0.94 }} className="m-1 shrink-0">
            <Button
              size="icon"
              aria-label={sendLabel}
              disabled={!sendable}
              onClick={submit}
              className={cn("size-9 rounded-full border-0 disabled:opacity-30", gradient)}
            >
              <ArrowUp className="size-4" />
            </Button>
          </motion.div>
        )}
      </div>

      {home && (
        <div className="flex min-h-10 items-center justify-between gap-2 px-1.5 pb-1 pt-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-1">{actions}</span>
          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="icon"
              aria-label={sendLabel}
              disabled={!sendable}
              onClick={submit}
              className={cn("size-9 shrink-0 rounded-full border-0 disabled:opacity-30", gradient)}
            >
              <ArrowUp className="size-4" />
            </Button>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
