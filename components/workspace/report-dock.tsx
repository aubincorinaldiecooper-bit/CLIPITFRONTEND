"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUp, MessageSquareWarning, X } from "lucide-react"
import { Button } from "@astryxdesign/core/Button"
import { HStack } from "@astryxdesign/core/HStack"
import { IconButton } from "@astryxdesign/core/IconButton"
import { Kbd } from "@astryxdesign/core/Kbd"
import { Text } from "@astryxdesign/core/Text"
import { TextArea } from "@astryxdesign/core/TextArea"
import { VStack } from "@astryxdesign/core/VStack"
import { MediaTheme } from "@astryxdesign/core/theme"
import { characterCount } from "@astryxdesign/core/utils"
import { Logo } from "@/components/brand/logo"
import { api } from "@/lib/api"
import { readReportContext } from "@/lib/report-context"

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
 *
 * Built from Astryx's furniture (Codex's finding on #88): the button, the
 * key, the box and the text are the components every other screen uses,
 * inside a MediaTheme so they read on the dark pill; the pill itself and
 * the collapse are the only things drawn here.
 */
type DockMode = "idle" | "composing" | "overlong" | "oversized" | "sending" | "sent" | "failed"

/**
 * The most a report may say, counted the way a person counts: an emoji, a
 * flag or an accented letter is one. The server holds the same line
 * (CLIPIT's `MAX_MESSAGE_CHARACTERS`), counted the same way.
 */
const MAX_LENGTH = 2000
/**
 * The server's outer bound on storage (CLIPIT's `MAX_MESSAGE_UNITS`), held
 * here too so nothing the box lets through is refused there: sixteen units
 * per character is more than the longest standard emoji sequence takes, so
 * only a run of combining marks — one "character" of any length — reaches
 * it, and it is refused with words that do not say "over 2,000 characters".
 */
const MAX_UNITS = MAX_LENGTH * 16

const fits = (text: string) => characterCount(text) <= MAX_LENGTH && text.length <= MAX_UNITS
/** How long "Got it" stays before the dock settles again. */
const SENT_LINGER_MS = 4000
const EASE = [0.22, 1, 0.36, 1] as const

const STATUS: Record<DockMode, string> = {
  idle: "Something not working? Tell us.",
  composing: "What were you doing, and what happened?",
  overlong: "That's over 2,000 characters — trim it a little, then send.",
  oversized: "That's more than one report can carry — trim it a little, then send.",
  sending: "Sending…",
  sent: "Got it — thanks. We'll look into it.",
  failed: "Couldn't send. Your words are still here — try again.",
}

const isTyping = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  return Boolean(element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable))
}

export function ReportDock() {
  const [mode, setMode] = useState<DockMode>("idle")
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const shouldReduceMotion = useReducedMotion()
  // Open through sending too: the box keeps its place while the words are
  // on their way, and does not collapse and spring back on a failure.
  const open = mode === "composing" || mode === "overlong" || mode === "oversized" || mode === "failed" || mode === "sending"
  const sending = mode === "sending"

  const openComposer = useCallback(() => {
    setMode((current) => (current === "sending" || current === "failed" || current === "overlong" || current === "oversized" ? current : "composing"))
  }, [])
  const close = useCallback(() => {
    setMode((current) => (current === "sending" ? current : "idle"))
  }, [])

  const send = useCallback(async () => {
    const text = message.trim()
    if (!text) {
      openComposer()
      return
    }
    // Never a prefix: a report longer than the server takes is refused
    // whole, with the words kept, rather than shortened and confirmed as
    // sent (Devin's finding on #88). Counted the way the box's counter
    // counts — an emoji is one character, not two — so the counter and
    // this refusal can never disagree; the server counts the same way.
    if (characterCount(text) > MAX_LENGTH) {
      setMode("overlong")
      return
    }
    if (text.length > MAX_UNITS) {
      setMode("oversized")
      return
    }
    setMode("sending")
    try {
      await api.sendReport({
        message: text,
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
  }, [message, openComposer])
  const latestSend = useRef(send)
  latestSend.current = send
  const sendingRef = useRef(sending)
  sendingRef.current = sending

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

  // Enter sends; Shift+Enter is a new line. On the element itself, since
  // the box is Astryx's and takes no key handler of its own.
  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return
      event.preventDefault()
      if (!sendingRef.current) void latestSend.current()
    }
    element.addEventListener("keydown", onKey)
    return () => element.removeEventListener("keydown", onKey)
  }, [open])

  useEffect(() => {
    if (mode !== "sent") return
    const timer = window.setTimeout(() => setMode("idle"), SENT_LINGER_MS)
    return () => window.clearTimeout(timer)
  }, [mode])

  return (
    <MediaTheme mode="dark">
      <VStack
        gap={2}
        padding={2}
        className="fixed bottom-4 left-4 right-4 z-(--z-dock) rounded-2xl bg-foreground shadow-2xl ring-1 ring-foreground/10 sm:left-auto sm:w-full sm:max-w-md"
        role="region"
        aria-label="Report a problem with Clipit"
        data-testid="report-dock"
      >
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="editor"
              initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={shouldReduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: EASE }}
              className="overflow-hidden"
            >
              <VStack gap={1}>
                <HStack justify="end">
                  <IconButton label="Close" icon={<X aria-hidden size={14} strokeWidth={2.5} />} variant="ghost" size="sm" onClick={close} isDisabled={sending} />
                </HStack>
                <TextArea
                  ref={textareaRef}
                  label="What went wrong"
                  isLabelHidden
                  value={message}
                  onChange={(value) => {
                    setMessage(value)
                    if ((mode === "overlong" || mode === "oversized") && fits(value.trim())) setMode("composing")
                  }}
                  maxLength={MAX_LENGTH}
                  rows={3}
                  size="sm"
                  placeholder="What were you doing, and what happened instead?"
                  isDisabled={sending}
                  hasAutoFocus
                />
              </VStack>
            </motion.div>
          )}
        </AnimatePresence>

        <HStack gap={3} align="center">
          <Logo variant="mark" size={18} className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/15" />
          <VStack gap={0.5} className="min-w-0 flex-1">
            <Text as="p" type="label" maxLines={1} hasTruncateTooltip={false}>
              Clipit
            </Text>
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
                data-testid="report-status"
                aria-live="polite"
              >
                {/* Two lines at most: on a phone the words wrap rather than vanish behind an ellipsis. */}
                <Text as="p" type="supporting" maxLines={2} hasTruncateTooltip={false}>
                  {STATUS[mode]}
                </Text>
              </motion.div>
            </AnimatePresence>
          </VStack>
          <HStack gap={1} align="center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              label={open ? "Send" : "Report"}
              icon={open ? <ArrowUp aria-hidden size={16} strokeWidth={2.5} /> : <MessageSquareWarning aria-hidden size={16} />}
              isDisabled={sending}
              onClick={() => {
                if (open) void send()
                else openComposer()
              }}
            />
            <Kbd keys={open ? "enter" : "R"} />
          </HStack>
        </HStack>
      </VStack>
    </MediaTheme>
  )
}
