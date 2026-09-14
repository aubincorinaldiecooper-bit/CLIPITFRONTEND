"use client"

import { useEffect, useState, type RefObject } from "react"

/**
 * The frame a phone's stage fills: the part of the page that is actually on
 * screen, which the on-screen keyboard makes smaller.
 *
 * Neither Safari on iOS nor Chrome on Android shrinks the page when the
 * keyboard opens. They shrink the VISUAL viewport — the part of the page you
 * can see — and pan it so the focused box is in view. A stage sized to the
 * page would then sit half under the keyboard with its top panned off the
 * screen. So the stage is sized to the visual viewport instead, and moved
 * down by the pan: the box stays above the keyboard, the footage above the
 * box — smaller, still playing — and nothing has to be scrolled to reach
 * either (the owner's ask, 2026-09-14: chat while the video plays).
 */
export interface StageFrame {
  /** How tall the stage should be, in pixels. */
  height: number
  /** How far down the stage must move to sit in the part of the page on screen. */
  shift: number
}

/** The part of the page on screen: its top in page pixels, and its height. */
export interface VisibleArea {
  top: number
  height: number
}

/** The frame for a stage whose natural top is `stageTop` page pixels down. */
export function stageFrame(visible: VisibleArea, stageTop: number): StageFrame {
  const bottom = visible.top + visible.height
  // The stage's top is on screen: fill from there down to the edge of what is visible.
  if (stageTop >= visible.top) return { height: Math.max(0, Math.round(bottom - stageTop)), shift: 0 }
  // Panned past the stage's top — the keyboard: take the whole visible part.
  return { height: Math.round(visible.height), shift: Math.round(visible.top - stageTop) }
}

/** The element's top in page pixels, before any transform of its own. */
function pageTop(element: HTMLElement): number {
  let top = 0
  for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop
  return top
}

/**
 * Measures the frame for `stage` while `active`, and again whenever the
 * visible part of the page changes — the keyboard, a rotation, a pan.
 * Null while inactive, so a wide screen is left to its own layout.
 */
export function useStageFrame(stage: RefObject<HTMLElement | null>, active: boolean): StageFrame | null {
  const [frame, setFrame] = useState<StageFrame | null>(null)

  useEffect(() => {
    if (!active) {
      setFrame(null)
      return
    }
    const element = stage.current
    if (!element) return
    const viewport = window.visualViewport ?? null
    const animated = typeof window.requestAnimationFrame === "function"
    let pending = 0

    const measure = () => {
      pending = 0
      const visible: VisibleArea = viewport
        ? { top: viewport.pageTop, height: viewport.height }
        : { top: window.scrollY, height: window.innerHeight }
      const next = stageFrame(visible, pageTop(element))
      setFrame((current) => (current && current.height === next.height && current.shift === next.shift ? current : next))
    }
    // One measure per frame, however many events a pan fires.
    const schedule = () => {
      if (pending) return
      pending = animated ? window.requestAnimationFrame(measure) : window.setTimeout(measure, 16)
    }

    measure()
    viewport?.addEventListener("resize", schedule)
    viewport?.addEventListener("scroll", schedule)
    window.addEventListener("resize", schedule)
    window.addEventListener("orientationchange", schedule)
    return () => {
      if (pending) {
        if (animated) window.cancelAnimationFrame(pending)
        else window.clearTimeout(pending)
      }
      viewport?.removeEventListener("resize", schedule)
      viewport?.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("orientationchange", schedule)
    }
  }, [stage, active])

  return frame
}
