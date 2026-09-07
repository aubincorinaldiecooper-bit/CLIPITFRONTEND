"use client"

import { Fragment, useMemo } from "react"
import { motion, useReducedMotion } from "motion/react"

/**
 * Words that arrive one after another, the way an answer does when someone
 * is telling you rather than handing you a report.
 *
 * The sentence is complete the moment it is rendered — screen readers and
 * tests see all of it — and only its appearance is staggered, word by
 * word, through motion (the app's own animation library). Each word is a
 * span because a word is text, not layout: nothing here sizes or positions
 * anything. For anyone who asked for less motion the words simply appear,
 * asked directly (Codex's finding on #88: MotionConfig's reduced-motion
 * setting stops transforms, not a fade). A line whose words change streams
 * the changed words again and leaves the rest still.
 */
const STEP_SECONDS = 0.034
const WORD_SECONDS = 0.42
const EASE = [0.22, 0.61, 0.25, 1] as const

export function StreamedText({ text, className }: { text: string; className?: string }) {
  const words = useMemo(() => text.split(" "), [text])
  const still = useReducedMotion() === true
  return (
    <span className={className} data-testid="streamed-text" data-still={still ? "true" : undefined}>
      {words.map((word, index) => (
        <Fragment key={`${index}-${word}`}>
          {index > 0 ? " " : null}
          <motion.span
            className="inline-block"
            initial={still ? false : { opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={still ? { duration: 0 } : { duration: WORD_SECONDS, ease: EASE, delay: index * STEP_SECONDS }}
          >
            {word}
          </motion.span>
        </Fragment>
      ))}
    </span>
  )
}
