"use client"

import { AspectRatio } from "@astryxdesign/core"
import type { ReactNode } from "react"

/**
 * The frame a source video plays in, shaped by the video itself.
 *
 * The theater stage used a fixed 16:9 box. A phone video held upright still
 * played the right way up inside it, but with a black bar down each side and
 * the wide frame around it — which reads, correctly, as "my video is being
 * shown in landscape". Nothing was rotated; the box was simply the wrong
 * shape and the footage had to fit inside it.
 *
 * VerticalFrame is the same idea fixed at 9:16, for clips, which really are
 * that shape. This one is for the original, which can be any shape at all,
 * so the ratio comes from the dimensions the backend measured. Those are the
 * DISPLAY dimensions — a file that asks to be turned a quarter turn is
 * already reported with its sides swapped — so an upright video arrives here
 * as an upright ratio and needs no special case.
 */

const LANDSCAPE = 16 / 9

/**
 * An upright video would otherwise run off the bottom of the screen: the box
 * takes its width from the stage, so a 9:16 video across the stage's full
 * width is nearly twice the height of the viewport. Capping the height only
 * works if the width is released to follow it — AspectRatio's own docs are
 * explicit that a height cap on its own clamps the box off ratio and squashes
 * the picture, and a rendered check confirmed exactly that.
 *
 * Two roads not taken, both dead ends worth recording:
 *
 *  - StyleX. It is a transitive dependency here, not a configured one:
 *    nothing in this app compiles `stylex.create`, so calling it throws the
 *    moment the component renders.
 *  - Tailwind utilities. `w-auto` has to beat the component's own
 *    `width: 100%`, and both are single-class selectors, so which wins is
 *    decided by stylesheet order — not something to leave to chance when
 *    losing means a squashed picture.
 *
 * So this is inline, deliberately, against the usual rule. It is the same
 * category of value as the ratio itself, which AspectRatio also applies
 * inline because it cannot be a static class. `svh` rather than `vh` so a
 * phone's address bar cannot push the controls off the bottom.
 */
const UPRIGHT_CAP = { maxHeight: "70svh", width: "auto" } as const

export function SourceFrame({
  children,
  width,
  height,
  className,
}: {
  children: ReactNode
  /** Display width as measured at upload. Null until the video is probed. */
  width: number | null | undefined
  height: number | null | undefined
  className?: string
}) {
  const measured =
    typeof width === "number" && typeof height === "number" && width > 0 && height > 0
  // 16:9 while the dimensions are still unknown: the stage renders before the
  // probe lands, and a box that resizes once is better than one that starts
  // at some arbitrary square.
  const ratio = measured ? width / height : LANDSCAPE
  const upright = ratio < 1

  return (
    <AspectRatio ratio={ratio} className={className} style={upright ? UPRIGHT_CAP : undefined}>
      {children}
    </AspectRatio>
  )
}
