"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { eachCard } from "@/components/clip-card"

/**
 * One row of the library: a heading, a pair of round arrows, "Show all", and
 * the cards scrolling sideways under it — the row shape of the owner's
 * reference (the Airbnb rows the kokonutui carousel cards recreate).
 *
 * Built on a plain scroll container rather than the app's embla carousel: a
 * row of cards wants native touch scrolling and snap points, and the arrows
 * only page it. "Show all" turns the row into a wrapped grid in place, so
 * seeing everything from one video never leaves the page.
 */
export function ClipRow({
  title,
  count,
  children,
}: {
  title: string
  /** How many cards the row holds, said next to the title. */
  count: number
  /** The cards. Their keys are kept; the row sizes and snaps them. */
  children: ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    measure()
    const el = scroller.current
    if (!el || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure, showAll, count])

  const page = (direction: 1 | -1) => {
    const el = scroller.current
    if (!el || typeof el.scrollBy !== "function") return
    // One screen of cards per press. Reduced motion jumps instead of gliding.
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollBy({ left: direction * Math.max(240, Math.floor(el.clientWidth * 0.9)), behavior: reduce ? "auto" : "smooth" })
  }

  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-base font-medium tracking-tight md:text-lg">
          {title} <span className="font-normal text-foreground/60">· {count}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {!showAll && (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                aria-label={`Scroll ${title} back`}
                disabled={atStart}
                onClick={() => page(-1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                aria-label={`Scroll ${title} forward`}
                disabled={atEnd}
                onClick={() => page(1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="whitespace-nowrap" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Show less" : "Show all"}
          </Button>
        </div>
      </div>

      {showAll ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {eachCard(children, "min-w-0")}
        </div>
      ) : (
        <div
          ref={scroller}
          onScroll={measure}
          className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
        >
          {eachCard(children, "w-[190px] flex-none snap-start sm:w-[220px]")}
        </div>
      )}
    </section>
  )
}
