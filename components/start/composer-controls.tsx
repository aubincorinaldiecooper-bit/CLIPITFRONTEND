"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * The strip under the box: which model, and how hard to look.
 *
 * Both are the owner's, ported from the composer they drafted for a new home
 * page, and both are COSMETIC — their instruction, 9 September: the levels are
 * "static right now, just cosmetic until I figure that out", and connecting
 * the model choice to OpenRouter is theirs to do. Nothing here is sent
 * anywhere. Neither control has a callback out on purpose: there is nothing
 * downstream that could quietly start depending on a choice that decides
 * nothing, and wiring one later is a prop rather than an unpicking.
 *
 * Kept from the draft: the label whose width animates as it changes, the
 * highlight that slides between menu rows rather than blinking on and off,
 * the three bars that fill as the effort rises, and their spring curve.
 */

const SPRING = "cubic-bezier(0.175, 0.885, 0.32, 1.275)"

/** The owner's list, as drawn in their reference. */
export const MODELS = ["GPT 5.5", "Opus 4.8", "Gemini 3.5 Flash", "Composer 2.5", "GLM 5.2"] as const
export const EFFORTS = ["Low", "Medium", "Max Effort"] as const

/** Height of one menu row, and the distance the highlight travels between them. */
const ROW = 34

/**
 * A label that changes width as smoothly as it changes text.
 *
 * The invisible copy holds the space so the row never jumps; the visible one
 * is keyed on the text so it re-enters when it changes.
 */
function MorphingLabel({ text }: { text: string }) {
  const [width, setWidth] = useState<number | "auto">("auto")
  const measured = useRef<HTMLSpanElement>(null)

  // Before paint, so the first render is never a wrong width that corrects
  // itself visibly.
  useLayoutEffect(() => {
    if (measured.current) setWidth(measured.current.offsetWidth)
  }, [text])

  return (
    <span
      className="relative inline-flex items-center justify-center overflow-hidden transition-all duration-300"
      style={{ width, transitionTimingFunction: SPRING }}
    >
      <span ref={measured} className="invisible whitespace-nowrap px-1">
        {text}
      </span>
      <span
        key={text}
        className="absolute inset-0 flex animate-in items-center justify-center whitespace-nowrap fade-in zoom-in-95 duration-300"
      >
        {text}
      </span>
    </span>
  )
}

/**
 * A place for each model's mark.
 *
 * Deliberately blank. The draft hotlinked five vendor logos from a
 * third-party CDN, which is not something to ship — the page would break when
 * that host moved, and the marks are not ours to serve from someone else's
 * bucket. Drop real files into public/models/ and give this a src.
 */
function ModelMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("size-3.5 shrink-0 rounded-[4px] bg-foreground/20", className)} />
}

/** Three bars, filling as the effort rises. The draft's icon, kept. */
function EffortBars({ level }: { level: string }) {
  const middle = level === "Medium" || level === "Max Effort"
  const tallest = level === "Max Effort"
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="1.5" y="8" width="2.5" height="4.5" rx="1" fill="currentColor" />
      <rect x="5.75" y="5" width="2.5" height="7.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={middle ? 1 : 0.3} />
      <rect x="10" y="2" width="2.5" height="10.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={tallest ? 1 : 0.3} />
    </svg>
  )
}

/**
 * `accent` is Clipit's brand yellow, so the draft's neutral hover would have
 * shouted here. A soft lift off the foreground keeps its quietness.
 */
const PILL =
  "group flex items-center gap-1 rounded-full px-2 py-1 text-foreground/50 outline-none transition-all duration-200 hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"

export function ModelPicker({ value, onChange }: { value: string; onChange: (model: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  /** Which row the highlight sits behind, or null when it should be hidden. */
  const [hovered, setHovered] = useState<number | null>(null)
  const holder = useRef<HTMLSpanElement>(null)

  // Closing on a click elsewhere, and on Escape, because a menu that can only
  // be closed by choosing something is a trap.
  useEffect(() => {
    if (!isOpen) return
    const onDown = (event: MouseEvent) => {
      if (holder.current && !holder.current.contains(event.target as Node)) setIsOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [isOpen])

  const choose = useCallback(
    (model: string) => {
      onChange(model)
      setIsOpen(false)
      setHovered(null)
    },
    [onChange],
  )

  return (
    <span ref={holder} className="relative inline-flex">
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(PILL, isOpen && "bg-foreground/10 text-foreground")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Model: ${value}`}
      >
        <ModelMark className="opacity-70 transition-opacity group-hover:opacity-100" />
        <span className="whitespace-nowrap text-xs font-semibold select-none">
          <MorphingLabel text={value} />
        </span>
      </button>

      <span
        role="menu"
        aria-label="Model"
        onMouseLeave={() => setHovered(null)}
        style={{ transformOrigin: "bottom left" }}
        className={cn(
          "absolute bottom-full left-0 z-50 mb-2.5 flex w-44 flex-col gap-0.5 rounded-2xl border border-border bg-card/95 p-1 shadow-xl backdrop-blur-md transition-all duration-300",
          isOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-95 opacity-0",
        )}
      >
        <span className="relative flex flex-col gap-0.5">
          {/* One highlight that slides, rather than five that blink. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-8 rounded-xl bg-foreground/10 transition-all duration-300"
            style={{
              opacity: hovered === null ? 0 : 1,
              transform: `translateY(${(hovered ?? 0) * ROW}px) scale(${hovered === null ? 0.95 : 1})`,
              transitionTimingFunction: SPRING,
            }}
          />
          {MODELS.map((model, index) => (
            <button
              key={model}
              type="button"
              role="menuitemradio"
              aria-checked={model === value}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onClick={() => choose(model)}
              className="relative flex h-8 w-full items-center rounded-xl px-2.5 text-left text-xs font-medium text-foreground/80 outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-2 whitespace-nowrap">
                <ModelMark className="opacity-85" />
                {model}
              </span>
            </button>
          ))}
        </span>
      </span>
    </span>
  )
}

/** Cycles Low → Medium → Max Effort, the way the draft's did. */
export function EffortDial({ value, onChange }: { value: string; onChange: (effort: string) => void }) {
  const step = () => {
    const next = (EFFORTS.indexOf(value as (typeof EFFORTS)[number]) + 1) % EFFORTS.length
    onChange(EFFORTS[next])
  }

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={step}
      className={PILL}
      aria-label={`Effort: ${value}. Press to change.`}
    >
      <EffortBars level={value} />
      <span className="whitespace-nowrap text-xs font-semibold select-none">
        <MorphingLabel text={value} />
      </span>
    </button>
  )
}
