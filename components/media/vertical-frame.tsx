"use client"

import { AspectRatio } from "@astryxdesign/core"
import type { ReactNode } from "react"

/**
 * Vertical media, framed by Astryx.
 *
 * The ratio boxes in this app were hand-rolled Tailwind (`aspect-video`,
 * `aspect-[3/4]`, `aspect-[9/16]`) — several different declarations across
 * four files, each its own chance to drift. The owner's call (2026-08-31) is
 * that Astryx's AspectRatio owns this behaviour, not our CSS. It was already
 * a dependency and its stylesheet was already imported; nothing here
 * recreates what it does.
 *
 * VERTICAL is 9 / 16 — the canonical ratio, matching what the backend
 * actually renders: MiniCPM judges the framing, planReframe computes the crop
 * geometry, FFmpeg encodes the derivative. This component is only how that
 * result is presented, and it must not disagree with the file.
 *
 * On `fit`, which is the one real decision here:
 *
 *  - POSTERS and finished VERTICAL derivatives use `cover`. The file is
 *    already 9:16, so there is nothing to crop — cover simply fills the box.
 *  - A LANDSCAPE source shown in a vertical box uses `contain`. Cropping it
 *    to fill would throw away the sides of a frame nobody chose to cut, which
 *    is exactly the loss the backend's blurred-background mode exists to
 *    prevent. Letterboxing here is honest: it shows the whole frame and does
 *    not pretend the clip is vertical when it is not.
 */

export const VERTICAL_RATIO = 9 / 16

export function VerticalFrame({
  children,
  /** True once the media really is a 9:16 asset. Landscape stays `contain`. */
  isVertical = true,
  className,
  style,
}: {
  children: ReactNode
  isVertical?: boolean
  className?: string
  /**
   * Forwarded so the frame can BE the positioned element rather than sit
   * inside one. The deck's fanned shells are absolutely placed and
   * transformed; wrapping them in another box would put the ratio on the
   * wrapper and leave the shell itself with no height.
   *
   * Astryx merges this and then sets `aspectRatio` itself, so the ratio
   * always wins and a caller cannot accidentally override the shape.
   */
  style?: React.CSSProperties
}) {
  return (
    <AspectRatio
      ratio={VERTICAL_RATIO}
      fit={isVertical ? "cover" : "contain"}
      className={className}
      style={style}
    >
      {children}
    </AspectRatio>
  )
}
