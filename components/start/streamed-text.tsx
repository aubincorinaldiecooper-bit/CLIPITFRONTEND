"use client"

import { Fragment, useMemo } from "react"
import { motion } from "motion/react"

/**
 * Words that arrive one after another, the way an answer does when someone
 * is telling you rather than handing you a report.
 *
 * The sentence is complete the moment it is rendered — screen readers and
 * tests see all of it — and only its appearance is staggered, word by
 * word, through motion (the app's own animation library, which honours
 * reduced motion through the MotionConfig in components/providers.tsx).
 * Each word is a span because a word is text, not layout: nothing here
 * sizes or positions anything (Codex's finding on #87 asked for the
 * inline style this used to carry to go, and it has). A line whose words
 * change streams the changed words again and leaves the rest still.
 */
const STEP_SECONDS = 0.034
const WORD_SECONDS = 0.42
const EASE = [0.22, 0.61, 0.25, 1] as const

export function StreamedText({ text, className }: { text: string; className?: string }) {
  const words = useMemo(() => text.split(" "), [text])
  return (
    <span className={className} data-testid="streamed-text">
      {words.map((word, index) => (
        <Fragment key={`${index}-${word}`}>
          {index > 0 ? " " : null}
          <motion.span
            className="inline-block"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: WORD_SECONDS, ease: EASE, delay: index * STEP_SECONDS }}
          >
            {word}
          </motion.span>
        </Fragment>
      ))}
    </span>
  )
}
