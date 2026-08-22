"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"
import { ProgressBar as AstryxProgressBar } from "@astryxdesign/core/ProgressBar"

export const EASE = [0.2, 0.03, 0.26, 0.99] as const

export type StepState = "upcoming" | "active" | "done"

interface StepShellProps {
  index: number
  title: string
  state: StepState
  /** One-line recap shown once the step is behind you. */
  summary?: ReactNode
  children: ReactNode
}

/**
 * One stage of the flow.
 *
 * Steps reveal progressively: an upcoming step is not rendered at all, the
 * active step is expanded, and a finished step collapses to a single summary
 * line so the whole journey stays visible above the current work.
 */
export function StepShell({ index, title, state, summary, children }: StepShellProps) {
  const reduced = useReducedMotion()

  if (state === "upcoming") return null

  const done = state === "done"

  return (
    <motion.section
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: EASE }}
      className={`w-full rounded-2xl border transition-colors duration-500 ${
        done
          ? "border-white/5 bg-white/[0.015] px-5 py-4"
          : "border-white/10 bg-white/[0.03] px-5 py-6 sm:px-7 sm:py-7"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums transition-colors duration-500 ${
            done ? "bg-white/10 text-foreground/50" : "bg-foreground text-background"
          }`}
        >
          {done ? "✓" : index}
        </span>
        <h2 className={`font-medium tracking-tight ${done ? "text-base text-foreground/60" : "text-xl"}`}>{title}</h2>
        {done && summary && (
          <span className="ml-auto truncate pl-4 text-right text-xs text-foreground/40">{summary}</span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!done && (
          <motion.div
            key="body"
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pt-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

/**
 * Thin determinate progress bar used by the upload, processing and search
 * steps — Astryx's underneath, so it carries the progressbar role and aria
 * values; the surrounding copy stays the visible label.
 */
export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent))
  return <AstryxProgressBar value={clamped} max={100} label="Progress" isLabelHidden />
}
