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

/**
 * The owner's list, as drawn in their reference, each with the file its mark
 * would come from.
 *
 * Those files are not in the repository yet. The draft hotlinked them from a
 * third-party CDN, which is not something to ship and is not reachable from
 * here anyway, and drawing another company's mark from memory would be
 * inventing their branding. So each one is tried and quietly falls back to a
 * plain square when it is not there: dropping the five SVGs into
 * public/models/ is the whole job, with no code change.
 *
 * `invert` is for the marks that are drawn in near-black. Clipit's ground is
 * dark, so those would otherwise be invisible; the coloured ones are left
 * alone. It follows the owner's reference, where three of the five are
 * monochrome.
 */
export const MODELS = [
  { name: "GPT 5.5", mark: "/models/gpt.svg", invert: true },
  { name: "Opus 4.8", mark: "/models/opus.svg", invert: false },
  { name: "Gemini 3.5 Flash", mark: "/models/gemini.svg", invert: false },
  { name: "Composer 2.5", mark: "/models/composer.svg", invert: true },
  { name: "GLM 5.2", mark: "/models/glm.svg", invert: true },
] as const

export const MODEL_NAMES = MODELS.map((model) => model.name)
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
 * A model's mark, or a plain square while its file is missing.
 *
 * A broken-image glyph would be worse than no mark at all, so a file that
 * does not load is replaced by the square rather than shown failing.
 */
function ModelMark({ name, className }: { name: string; className?: string }) {
  const model = MODELS.find((entry) => entry.name === name)
  const [missing, setMissing] = useState(false)
  const [drawn, setDrawn] = useState(name)
  const picture = useRef<HTMLImageElement>(null)

  /**
   * Whose mark this is has changed, so what happened to the last one says
   * nothing about this one.
   *
   * Devin's finding on #90: the picker's button keeps one of these and only
   * changes its name, so a model with no file left `missing` set and every
   * model chosen afterwards showed the square, file or not. Resetting on the
   * way past is better than asking callers to remember a key, which is a
   * thing a caller can forget.
   */
  if (drawn !== name) {
    setDrawn(name)
    setMissing(false)
  }

  /**
   * A file that fails before React has attached its handler never fires one,
   * and an empty `alt` draws nothing at all — so four missing marks left four
   * blank gaps rather than four squares. Asking the element directly covers
   * the load that already finished, for each model this draws.
   */
  useEffect(() => {
    const element = picture.current
    if (element && element.complete && element.naturalWidth === 0) setMissing(true)
  }, [name])

  if (!model || missing) {
    return <span aria-hidden="true" className={cn("size-3.5 shrink-0 rounded-[4px] bg-foreground/20", className)} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={picture}
      src={model.mark}
      alt=""
      aria-hidden="true"
      onError={() => setMissing(true)}
      className={cn("size-3.5 shrink-0 object-contain", model.invert && "invert", className)}
    />
  )
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
  const trigger = useRef<HTMLButtonElement>(null)

  /**
   * Close, without losing the keyboard's place.
   *
   * `inert` takes the closing menu out of the document, so an option holding
   * the focus loses it to nothing and the next Tab starts again from the top
   * of the page — Devin's finding on #90, and a consequence of the fix that
   * added `inert`. The focus belongs back on the button that opened the menu.
   *
   * Only when it is leaving the menu, though. A click elsewhere keeps the
   * focus it earns, so that path closes without touching it.
   */
  const close = useCallback(() => {
    const leaving = holder.current?.contains(document.activeElement)
    setIsOpen(false)
    if (leaving) trigger.current?.focus()
  }, [])

  // Closing on a click elsewhere, and on Escape, because a menu that can only
  // be closed by choosing something is a trap.
  useEffect(() => {
    if (!isOpen) return
    const onDown = (event: MouseEvent) => {
      if (holder.current && !holder.current.contains(event.target as Node)) setIsOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [isOpen, close])

  const choose = useCallback(
    (model: string) => {
      onChange(model)
      close()
      setHovered(null)
    },
    [close, onChange],
  )

  return (
    <span ref={holder} className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(PILL, isOpen && "bg-foreground/10 text-foreground")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Model: ${value}`}
      >
        <ModelMark name={value} className="opacity-70 transition-opacity group-hover:opacity-100" />
        <span className="whitespace-nowrap text-xs font-semibold select-none">
          <MorphingLabel text={value} />
        </span>
      </button>

      <span
        role="menu"
        aria-label="Model"
        onMouseLeave={() => setHovered(null)}
        /**
         * Closed means closed to the keyboard too. `pointer-events-none`
         * stops a mouse and nothing else, so the five options stayed in the
         * tab order while invisible and could be reached and chosen by
         * someone who never saw them — Devin's finding on #90. `inert` takes
         * them out of the tab order and the accessibility tree while leaving
         * the closing animation to play.
         */
        inert={!isOpen}
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
              key={model.name}
              type="button"
              role="menuitemradio"
              aria-checked={model.name === value}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onClick={() => choose(model.name)}
              className="relative flex h-8 w-full items-center rounded-xl px-2.5 text-left text-xs font-medium text-foreground/80 outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-2 whitespace-nowrap">
                <ModelMark name={model.name} className="opacity-85" />
                {model.name}
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
