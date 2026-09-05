"use client"

import { Fragment, useMemo } from "react"

/**
 * Words that arrive one after another, the way an answer does when someone
 * is telling you rather than handing you a report.
 *
 * The sentence is complete the moment it is rendered — screen readers and
 * tests see all of it — and only its appearance is staggered, word by word,
 * with the app's own `stream-in` keyframe (globals.css, which also stops
 * every CSS animation for anyone who asked for less motion). A line whose
 * words change streams the changed words again and leaves the rest still.
 */
const STEP_MS = 34
const WORD_MS = 420

export function StreamedText({ text, className }: { text: string; className?: string }) {
  const words = useMemo(() => text.split(" "), [text])
  return (
    <span className={className} data-testid="streamed-text">
      {words.map((word, index) => (
        <Fragment key={`${index}-${word}`}>
          {index > 0 ? " " : null}
          {/* A computed delay, not a design value: each word waits its turn. */}
          <span
            className="inline-block"
            style={{ animation: `stream-in ${WORD_MS}ms cubic-bezier(0.22,0.61,0.25,1) ${index * STEP_MS}ms both` }}
          >
            {word}
          </span>
        </Fragment>
      ))}
    </span>
  )
}
