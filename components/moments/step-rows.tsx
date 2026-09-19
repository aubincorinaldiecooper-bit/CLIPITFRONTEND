"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { searchSteps, type SearchStep, type SearchStepsInput, type StepState } from "@/components/start/search-steps"

/**
 * What the search did, as rows you can open.
 *
 * The owner's TaskRows reference (Capsules), with its clock taken out. That
 * component scripts itself: row two turns red at 3.9 seconds and green at
 * 5.3, every run, whatever is happening. Here every badge, count and pill
 * comes from `searchSteps`, which reads the search's own numbers and nothing
 * else. A trace is the part of the screen people read as proof, so a trace
 * that animates a plausible sequence is worse than no trace at all.
 *
 * Three other departures from the reference, for the same reason:
 *
 * The failed pill has no retry control. There is no way to retry a search, so
 * a spinning retry icon would offer something that does not exist.
 *
 * A row opens only if it has something inside it. The reference gives every
 * row a chevron; two of these rows have no detail the browser is sent, and a
 * chevron that opens onto nothing is a promise of detail we do not have.
 *
 * Finding nothing is grey, never red. Watching seven videos and finding
 * nothing in them is a complete and correct answer; a red cross would report
 * a finished job as a broken one.
 */

const INK = "#1d2127"
const INK_2 = "#68707a"
const INK_3 = "#9aa1aa"
const LINE = "#e5e7eb"

const TONE: Record<string, { fg: string; bg: string }> = {
  green: { fg: "#12694f", bg: "#e6f3ee" },
  red: { fg: "#b23b2c", bg: "#fbeae7" },
  amber: { fg: "#8a6410", bg: "#fbf1dd" },
  grey: { fg: "#68707a", bg: "#f1f2f4" },
}

function pillFor(state: StepState): { text: string; tone: keyof typeof TONE } | null {
  switch (state) {
    case "done":
      return { text: "Done", tone: "green" }
    case "partial":
      return { text: "Partly", tone: "amber" }
    case "failed":
      return { text: "Failed", tone: "red" }
    case "none":
      return { text: "Nothing found", tone: "grey" }
    default:
      return null
  }
}

function Badge({ state, index }: { state: StepState; index: number }) {
  if (state === "running") {
    return (
      <span className="relative inline-flex size-6 shrink-0 items-center justify-center">
        <svg width={24} height={24} className="absolute inset-0" style={{ animation: "spin 1.1s linear infinite" }} aria-hidden>
          <circle cx={12} cy={12} r={11} fill="none" stroke={LINE} strokeWidth={2} />
          <circle
            cx={12}
            cy={12}
            r={11}
            fill="none"
            stroke={INK_3}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 11 * 0.28} ${2 * Math.PI * 11 * 0.72}`}
          />
        </svg>
        <span className="relative text-[10.5px] font-semibold tabular-nums" style={{ color: INK }}>
          {index}
        </span>
      </span>
    )
  }

  if (state === "pending") {
    return (
      <span className="inline-flex size-6 shrink-0 items-center justify-center">
        <svg width={24} height={24} aria-hidden>
          <circle cx={12} cy={12} r={11} fill="none" stroke={LINE} strokeWidth={2} />
        </svg>
        <span className="absolute text-[10.5px] font-semibold tabular-nums" style={{ color: INK_3 }}>
          {index}
        </span>
      </span>
    )
  }

  const tone =
    state === "done" ? TONE.green : state === "failed" ? TONE.red : state === "partial" ? TONE.amber : TONE.grey

  return (
    <span
      className="inline-flex size-5.5 shrink-0 items-center justify-center rounded-full"
      style={{ background: tone.fg, color: "#fff", animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
      aria-hidden
    >
      {state === "failed" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      ) : state === "none" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  )
}

function Row({ step, index }: { step: SearchStep; index: number }) {
  const [open, setOpen] = useState(false)
  const pill = pillFor(step.state)
  const openable = step.details.length > 0

  const head = (
    <>
      <Badge state={step.state} index={index} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium" style={{ color: step.state === "pending" ? INK_3 : INK }}>
        {step.label}
      </span>
      {step.amount && (
        <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: INK_2 }}>
          {step.amount}
        </span>
      )}
      {pill && (
        <span
          className="inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11.5px] font-medium whitespace-nowrap"
          style={{ color: TONE[pill.tone].fg, background: TONE[pill.tone].bg }}
        >
          {pill.text}
        </span>
      )}
      {/* Only where there is something to open. */}
      <span className="flex size-5 shrink-0 items-center justify-center" style={{ color: INK_3 }}>
        {openable && (
          <ChevronDown
            className="size-4 transition-transform duration-300"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            aria-hidden
          />
        )}
      </span>
    </>
  )

  return (
    <div
      className="overflow-hidden border border-[#e8eaed] bg-white shadow-[0_1px_2px_rgba(16,20,26,0.05)] transition-[border-radius] duration-300"
      style={{ borderRadius: open ? 14 : 20, animation: `fade-up 420ms cubic-bezier(0.23,1,0.32,1) ${(index - 1) * 80}ms both` }}
      data-testid="search-step"
      data-state={step.state}
      data-step={step.key}
    >
      {openable ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          className="flex h-11 w-full items-center gap-2.5 px-2.5 text-left transition-colors hover:bg-[#f7f8f9]"
        >
          {head}
        </button>
      ) : (
        <div className="flex h-11 w-full items-center gap-2.5 px-2.5">{head}</div>
      )}

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="mb-2.5 grid grid-cols-[24px_1fr] gap-2.5 px-2.5">
            <span aria-hidden className="mx-auto h-full w-px" style={{ background: LINE }} />
            <div className="flex flex-col gap-1.5">
              {step.details.map((detail, j) => {
                const body = (
                  <>
                    <span
                      className="min-w-0 flex-1 truncate text-[12px]"
                      style={{ color: detail.aside ? INK_3 : INK_2 }}
                      title={detail.label}
                    >
                      {detail.label}
                    </span>
                    {detail.meta && (
                      <span className="ml-3 shrink-0 font-mono text-[11.5px] tabular-nums" style={{ color: INK_3 }}>
                        {detail.meta}
                      </span>
                    )}
                  </>
                )
                const style = open
                  ? { animation: `fade-up 300ms cubic-bezier(0.23,1,0.32,1) ${120 + j * 90}ms both` }
                  : undefined
                return detail.href ? (
                  <a
                    key={`${detail.label}-${j}`}
                    href={detail.href}
                    target="_blank"
                    rel="noreferrer"
                    className="-mx-1 flex items-center rounded px-1 py-0.5 transition-colors hover:bg-[#f2f3f5]"
                    style={style}
                    data-testid="search-step-source"
                  >
                    {body}
                  </a>
                ) : (
                  <div key={`${detail.label}-${j}`} className="flex items-center py-0.5" style={style}>
                    {body}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StepRows(input: SearchStepsInput) {
  const steps = searchSteps(input)
  return (
    <div className="flex w-full flex-col gap-2" data-testid="search-steps">
      {steps.map((step, index) => (
        <Row key={step.key} step={step} index={index + 1} />
      ))}
    </div>
  )
}
