"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUp, Bug, X } from "lucide-react"
import { Button } from "@astryxdesign/core/Button"
import { HStack } from "@astryxdesign/core/HStack"
import { IconButton } from "@astryxdesign/core/IconButton"
import { Kbd } from "@astryxdesign/core/Kbd"
import { Text } from "@astryxdesign/core/Text"
import { TextArea } from "@astryxdesign/core/TextArea"
import { VStack } from "@astryxdesign/core/VStack"
import { characterCount } from "@astryxdesign/core/utils"
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
 * What it looks like (the owner, 2026-09-07: the first cut was a black
 * card the width of a paragraph, and it read as a notification rather than
 * a control): at rest, one round black button with a bug on it — the
 * account control's avatar circle, diagonally opposite it — whose tooltip
 * says "Got a bug? Tell us." and nothing else. No card, no standing
 * sentence asking to be read. Pressed, it grows into the box on the same
 * white card, edge and padding as the pill in the top-right corner, and
 * the words about what happened live inside that box, so the corner is
 * quiet again the moment the person is done.
 *
 * Built from Astryx's furniture (Codex's finding on #88): the button, the
 * key, the box and the text are the components every other screen uses;
 * the card itself and the collapse are the only things drawn here.
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

/**
 * Which line the words cross, if either — one test, asked on send and on
 * every edit, so the refusal on screen is always the one the words earn:
 * edited across the lines, a report cannot keep the other line's words
 * (Devin's finding on #88).
 */
const refusalFor = (text: string): "overlong" | "oversized" | null =>
  characterCount(text) > MAX_LENGTH ? "overlong" : text.length > MAX_UNITS ? "oversized" : null
/** How long "Got it" stays in the open box before the corner settles again. */
const SENT_LINGER_MS = 4000

/** What the box says about the words while it is open. At rest it says nothing. */
const STATUS: Record<Exclude<DockMode, "idle">, string> = {
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

/** The bug in the account control's avatar circle: the same size, the same black. */
const BugMark = () => (
  <HStack
    align="center"
    justify="center"
    className="size-9 shrink-0 rounded-full bg-primary text-primary-foreground"
  >
    <Bug aria-hidden size={18} />
  </HStack>
)

export function ReportDock() {
  const [mode, setMode] = useState<DockMode>("idle")
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const shouldReduceMotion = useReducedMotion()
  // Open for the whole exchange: while the words are typed, on their way,
  // refused, or just confirmed. The box does not collapse and spring back
  // on a failure, and "Got it" is read inside it before it closes.
  const open = mode !== "idle"
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
    const refusal = refusalFor(text)
    if (refusal) {
      setMode(refusal)
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

  if (!open) {
    // The account control's avatar circle, alone: black, round, the bug on
    // it. R opens it too, for anyone who read the tooltip once.
    return (
      <IconButton
        label="Report a bug"
        tooltip="Got a bug? Tell us."
        icon={<Bug aria-hidden size={18} />}
        variant="primary"
        size="lg"
        elevation="med"
        onClick={openComposer}
        // A circle, like the avatar in the account control: the button's own
        // horizontal padding would make a lozenge of it, so the square is
        // stated outright and the padding cleared.
        className="fixed bottom-4 right-4 z-(--z-dock) !size-14 !min-h-0 !p-0 rounded-full"
        data-testid="report-dock"
      />
    )
  }

  return (
    <VStack
      gap={2}
      padding={2}
      // The account control's card, edge and padding (profile-dropdown.tsx),
      // so the two corners match: the phone's whole width, a column on
      // anything wider.
      className="fixed bottom-4 left-4 right-4 z-(--z-dock) rounded-2xl border bg-card shadow-lg sm:left-auto sm:w-full sm:max-w-md"
      role="region"
      aria-label="Report a problem with Clipit"
      data-testid="report-dock"
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
            if (mode === "overlong" || mode === "oversized") setMode(refusalFor(value.trim()) ?? "composing")
            else if (mode === "sent") setMode("composing")
          }}
          maxLength={MAX_LENGTH}
          rows={3}
          size="sm"
          placeholder="What were you doing, and what happened instead?"
          isDisabled={sending}
          hasAutoFocus
        />
      </VStack>

      <HStack gap={3} align="center">
          <BugMark />
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
              className="min-w-0 flex-1"
              data-testid="report-status"
              aria-live="polite"
            >
              {/* Two lines at most: on a phone the words wrap rather than vanish behind an ellipsis. */}
              <Text as="p" type="supporting" maxLines={2} hasTruncateTooltip={false}>
                {STATUS[mode]}
              </Text>
            </motion.div>
          </AnimatePresence>
          <HStack gap={1} align="center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              label="Send"
              icon={<ArrowUp aria-hidden size={16} strokeWidth={2.5} />}
              isDisabled={sending}
              onClick={() => void send()}
            />
            <Kbd keys="enter" />
          </HStack>
        </HStack>
    </VStack>
  )
}
