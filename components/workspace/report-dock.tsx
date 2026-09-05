"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUp, MessageSquareWarning, X } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { api } from "@/lib/api"
import { readReportContext } from "@/lib/report-context"
import { cn } from "@/lib/utils"

/**
 * The report dock: a way to say "something is wrong" from any page, in the
 * bottom-right corner, on the owner's pick of 2026-09-05 (an agent dock
 * they liked the look of, made ours).
 *
 * What it is NOT: a conversation. Nothing answers here, so nothing here
 * pretends to. The dock takes the words, sends them with where they were
 * typed and what was on screen, and says exactly what happened to them —
 * sent, or not. Where they go from there is the server's configuration:
 * the database and the log always, and an issue where a fix can start when
 * the owner has wired one up.
 *
 * Ours, not the sample's: the mark instead of an avatar, the workspace's
 * black pill instead of a grey one, one control instead of two (there is
 * no voice), and a shortcut that is real — R opens it, Escape closes it —
 * rather than a chip that names a key nothing listens for.
 */
type DockMode = "idle" | "composing" | "sending" | "sent" | "failed"

const MAX_LENGTH = 2000
/** How long "Got it" stays before the dock settles again. */
const SENT_LINGER_MS = 4000
const EASE = [0.22, 1, 0.36, 1] as const

const STATUS: Record<DockMode, string> = {
  idle: "Something not working? Tell us.",
  composing: "What were you doing, and what happened?",
  sending: "Sending…",
  sent: "Got it — thanks. We'll look into it.",
  failed: "Couldn't send. Your words are still here — try again.",
}

function DockButton({
  icon,
  label,
  shortcut,
  disabled = false,
}: {
  icon: React.ReactNode
  label: string
  shortcut: string
  disabled?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-background transition hover:bg-background/10 disabled:opacity-60"
    >
      <span className="flex size-4 items-center justify-center">{icon}</span>
      <span>{label}</span>
      <kbd aria-hidden className="flex h-6 min-w-6 items-center justify-center rounded-md bg-background/15 px-1 text-xs">
        {shortcut}
      </kbd>
    </button>
  )
}

const isTyping = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  return Boolean(element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable))
}

export function ReportDock({ className }: { className?: string }) {
  const [mode, setMode] = useState<DockMode>("idle")
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const shouldReduceMotion = useReducedMotion()
  // Open through sending too: the box keeps its place while the words are
  // on their way, and does not collapse and spring back on a failure
  // (Codex's finding on #88).
  const open = mode === "composing" || mode === "failed" || mode === "sending"
  const sending = mode === "sending"

  const openComposer = useCallback(() => {
    setMode((current) => (current === "sending" ? current : current === "failed" ? current : "composing"))
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])
  const close = useCallback(() => {
    setMode((current) => (current === "sending" ? current : "idle"))
  }, [])

  // R opens it and Escape closes it — never while the person is typing
  // somewhere else, and never from inside a dialog, whose keys are its own.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest?.('[role="dialog"]')) return
      if (event.key === "Escape") {
        if (open && (textareaRef.current === target || !isTyping(target))) {
          event.preventDefault()
          close()
        }
        return
      }
      if (event.key !== "r" && event.key !== "R") return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(target) || open) return
      event.preventDefault()
      openComposer()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, openComposer, close])

  useEffect(() => {
    if (mode !== "sent") return
    const timer = window.setTimeout(() => setMode("idle"), SENT_LINGER_MS)
    return () => window.clearTimeout(timer)
  }, [mode])

  const send = async () => {
    const text = message.trim()
    if (!text) {
      openComposer()
      return
    }
    setMode("sending")
    try {
      await api.sendReport({
        message: text.slice(0, MAX_LENGTH),
        page: window.location.pathname,
        ...readReportContext(),
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      })
      setMessage("")
      setMode("sent")
    } catch {
      // The words stay in the box: a report that did not arrive is still
      // the person's report, and the status says it did not arrive.
      setMode("failed")
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mode === "sending") return
    if (open) {
      void send()
      return
    }
    openComposer()
  }

  const onTextareaKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    event.preventDefault()
    if (mode !== "sending") void send()
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Report a problem with Clipit"
      data-testid="report-dock"
      className={cn("fixed bottom-4 right-4 z-(--z-dock) w-[calc(100vw-2rem)] max-w-sm", className)}
    >
      <div className="flex w-full flex-col-reverse overflow-hidden rounded-2xl bg-foreground p-2 text-background shadow-2xl ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/15">
            <Logo variant="mark" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-none text-background">Clipit</p>
            <AnimatePresence initial={false} mode="wait">
              <motion.p
                key={mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
                className="mt-1 truncate text-xs text-background/70"
                data-testid="report-status"
                aria-live="polite"
              >
                {STATUS[mode]}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 items-center">
            {open ? (
              <DockButton icon={<ArrowUp aria-hidden size={16} strokeWidth={2.5} />} label="Send" shortcut="↵" disabled={sending} />
            ) : (
              <DockButton icon={<MessageSquareWarning aria-hidden size={16} />} label="Report" shortcut="R" disabled={sending} />
            )}
          </div>
        </div>

        <motion.div
          animate={{ height: open ? 120 : 0, opacity: open ? 1 : 0 }}
          aria-hidden={!open}
          className="overflow-hidden"
          initial={false}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: EASE }}
        >
          <div className="relative mb-2">
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              tabIndex={open ? 0 : -1}
              className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md text-background/70 transition hover:bg-background/10 hover:text-background"
            >
              <X aria-hidden size={14} strokeWidth={2.5} />
            </button>
            <textarea
              ref={textareaRef}
              aria-label="What went wrong"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={onTextareaKeyDown}
              placeholder="What were you doing, and what happened instead?"
              maxLength={MAX_LENGTH}
              disabled={sending}
              tabIndex={open ? 0 : -1}
              className="h-28 w-full resize-none bg-transparent px-2 py-2 pr-9 text-sm leading-6 text-background outline-none placeholder:text-background/50"
            />
          </div>
        </motion.div>
      </div>
    </form>
  )
}
