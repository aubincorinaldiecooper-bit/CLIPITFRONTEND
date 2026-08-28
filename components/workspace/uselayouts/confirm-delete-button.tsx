"use client"

import { Undo03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion, AnimatePresence } from "motion/react"
import { useEffect, useState } from "react"

/**
 * uselayouts' delete-button, put to work.
 *
 * The original demo morphs between "Delete Account" and "Cancel Deletion"
 * with a shared-layout spring and per-letter travel, counting down for
 * effect. Kept: the morph, the letter animation, the two-state shape — it is
 * the safest destructive control in the set, because the first press only
 * arms it. Changed: the labels come from the caller, the second press calls
 * a real handler, and arming quietly disarms itself after five seconds so a
 * half-pressed Remove is not left loaded on the page.
 *
 * The two background colours are literal rather than tokens because motion
 * interpolates concrete colours between states; they are the scoped shadcn
 * palette's destructive red and its soft tint.
 */
export function ConfirmDeleteButton({
  id,
  label,
  confirmLabel,
  onConfirm,
  busy = false,
}: {
  /** Unique per instance — the morph is a shared-layout animation, and two
   *  buttons sharing an id would morph into each other across rows. */
  id: string
  label: string
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
}) {
  const [armed, setArmed] = useState(false)
  const [animating, setAnimating] = useState(false)

  // An armed button that nobody presses goes back to safe on its own.
  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 5000)
    return () => clearTimeout(timer)
  }, [armed])

  const swap = (next: boolean) => {
    if (animating || busy) return
    setAnimating(true)
    setArmed(next)
    setTimeout(() => setAnimating(false), 400)
  }

  const letters = (word: string, key: string) =>
    word.split("").map((char, i) => (
      <motion.span
        key={`${key}-${i}`}
        initial={{ y: 12, opacity: 0, scale: 0.3 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -12, opacity: 0, scale: 0.3 }}
        transition={{ duration: 0.3, delay: i * 0.005, ease: [0.785, 0.135, 0.15, 0.86] }}
        className="inline-block whitespace-pre"
      >
        {char}
      </motion.span>
    ))

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {!armed ? (
        <motion.button
          key="arm"
          layoutId={`confirmDelete-${id}`}
          type="button"
          onClick={() => swap(true)}
          whileTap={{ scale: 0.95 }}
          style={{ pointerEvents: animating ? "none" : "auto" }}
          initial={{ backgroundColor: "#fef2f2", filter: "blur(1px)", opacity: 1 }}
          animate={{ backgroundColor: "#fef2f2", filter: "blur(0px)", opacity: 1 }}
          exit={{ backgroundColor: "#dc2626", filter: "blur(1px)", opacity: 0 }}
          className="flex items-center justify-center overflow-hidden rounded-full px-3.5 py-1.5 text-xs font-medium text-[#dc2626]"
          transition={{
            layout: { duration: 0.4, ease: [0.77, 0, 0.175, 1] },
            backgroundColor: { duration: 0.4, ease: "easeInOut" },
            filter: { duration: 0.1, ease: "easeInOut" },
            opacity: { duration: 0.2, ease: "easeOut" },
          }}
        >
          <motion.span
            layoutId={`confirmDeleteText-${id}`}
            className="flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            {letters(label, "arm")}
          </motion.span>
        </motion.button>
      ) : (
        <motion.button
          key="confirm"
          layoutId={`confirmDelete-${id}`}
          type="button"
          onClick={() => {
            if (animating || busy) return
            onConfirm()
            setArmed(false)
          }}
          whileTap={{ scale: 0.95 }}
          style={{ pointerEvents: animating ? "none" : "auto" }}
          initial={{ backgroundColor: "#fef2f2", filter: "blur(1px)", opacity: 0 }}
          animate={{ backgroundColor: "#dc2626", filter: "blur(0px)", opacity: 1 }}
          exit={{ backgroundColor: "#fef2f2", filter: "blur(1px)", opacity: 0 }}
          className="flex items-center justify-center gap-1.5 overflow-hidden rounded-full px-3.5 py-1.5 text-xs font-medium text-white"
          transition={{
            layout: { duration: 0.4, ease: [0.77, 0, 0.175, 1] },
            backgroundColor: { duration: 0.4, ease: "easeInOut" },
            filter: { duration: 0.1, ease: "easeInOut" },
            opacity: { duration: 0.2, ease: "easeOut" },
          }}
        >
          <HugeiconsIcon icon={Undo03Icon} className="size-3.5" />
          <motion.span
            layoutId={`confirmDeleteText-${id}`}
            className="flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            {letters(busy ? "…" : confirmLabel, "confirm")}
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
