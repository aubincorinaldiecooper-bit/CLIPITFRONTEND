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
  "bg-[#ffe58a] text-[#273142] shadow-none hover:bg-[#ffdf73]"

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
        "flex w-full flex-col border border-[#dfe2e6] bg-[#fbfbfc] transition-[box-shadow,border-color]",
        home
          ? "rounded-[20px] p-2 shadow-[0_2px_5px_rgba(16,24,40,0.05)] focus-within:border-[#cfd3d8] focus-within:shadow-[0_4px_12px_rgba(16,24,40,0.07)]"
          : "rounded-[18px] p-1.5 shadow-[0_2px_8px_rgba(16,24,40,0.06)] focus-within:border-[#cfd3d8]",
        dragging && "border-[#9ed8ff] shadow-[0_22px_60px_rgba(71,111,153,0.16)]",
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
            "resize-none border-0 bg-transparent text-[#1d2530] shadow-none placeholder:text-[#5f6874] focus-visible:border-0 focus-visible:ring-0 disabled:bg-transparent",
            home
              ? "min-h-[68px] rounded-[16px] px-4 pt-4 pb-2 text-[15px] max-[860px]:text-base!"
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
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-1">{actions}</span>
          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="icon-lg"
              aria-label={sendLabel}
              disabled={!sendable}
              onClick={submit}
              className={cn("shrink-0 rounded-full border-0 disabled:opacity-30", gradient)}
            >
              <ArrowUp className="size-4" />
            </Button>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
