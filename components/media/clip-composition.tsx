"use client"

import type { CSSProperties, ReactElement } from "react"
import { AspectRatio } from "@astryxdesign/core/AspectRatio"
import type { ClipComposition as Composition } from "@/lib/types"

/**
 * One box, one framing, everywhere a moment is shown.
 *
 * The card, the Preview and the kept tile used to size and position their
 * media separately — and one of them showed the landscape source inside a
 * portrait box with the bottom half empty. This component takes the
 * composition the server decided (the same numbers the export was cut from)
 * and turns it into the two things CSS needs: the box's ratio and where the
 * media sits inside it. Nothing here recalculates a crop.
 *
 * Opening a moment should feel like enlarging the card, not switching to a
 * different picture of it. Both use this.
 */

const RATIOS: Record<string, number> = { "9:16": 9 / 16, "16:9": 16 / 9, "1:1": 1, "4:5": 4 / 5, "4:3": 4 / 3, "3:4": 3 / 4 }

/** '9:16' → 9/16. Unknown labels (including 'source') fall back to the given ratio. */
export function ratioFromLabel(label: string | null | undefined, fallback: number): number {
  if (!label) return fallback
  if (RATIOS[label]) return RATIOS[label]
  const [w, h] = label.split(":").map(Number)
  return Number.isFinite(w) && Number.isFinite(h) && h > 0 ? w / h : fallback
}

/**
 * Where the media sits inside the box, as CSS object-position.
 *
 * `focusPct` runs along the axis being CUT: horizontal when the source is
 * wider than the box, vertical when it is taller. The crop says which, when
 * there is one; otherwise the two ratios do. A source already the box's
 * shape has nothing cut and sits centred.
 */
export function objectPositionFor(composition: Composition, sourceAspectRatio?: string | null): string {
  const focus = Math.min(100, Math.max(0, composition.focusPct))
  const target = ratioFromLabel(composition.aspectRatio, 9 / 16)
  if (composition.crop) {
    if (composition.crop.width < 1) return `${focus}% 50%`
    if (composition.crop.height < 1) return `50% ${focus}%`
    return "50% 50%"
  }
  const source = ratioFromLabel(sourceAspectRatio, target)
  if (Math.abs(source - target) < 0.01) return "50% 50%"
  return source > target ? `${focus}% 50%` : `50% ${focus}%`
}

/**
 * How the box holds what it is given.
 *
 * A FINISHED file — the rendered derivative, or a poster cut from it — is
 * already the composition's shape and fills the box. Raw source is another
 * matter: only a smart crop can be reproduced by covering and positioning,
 * because that is literally what the export does. A padded or blurred
 * delivery keeps the WHOLE frame, so raw source shown for it must too; and
 * a vertical moment whose framing has not been decided yet is shown whole
 * rather than through a guessed crop, so nobody rejects a moment because a
 * centre crop hid its subject.
 */
export function fitFor(composition: Composition, finished: boolean): "cover" | "contain" {
  if (finished) return "cover"
  if (composition.mode === "smart_crop") return "cover"
  if (composition.crop) return "cover"
  // Nothing decided, or a whole-frame mode: the source's own shape is the
  // box's shape when the moment is not vertical, so nothing is cut either way.
  return composition.aspectRatio === "9:16" ? "contain" : "cover"
}

export function ClipComposition({
  composition,
  sourceAspectRatio,
  finished = true,
  className,
  style: frameStyle,
  children,
}: {
  composition: Composition
  /** The media's own shape, so the cut axis can be told when there is no crop yet. */
  sourceAspectRatio?: string | null
  /**
   * True when the child is a finished, framed file (the derivative or its
   * poster). False for raw source shown in the moment's place.
   */
  finished?: boolean
  className?: string
  /** Forwarded to the box, as VerticalFrame does, so a fanned card can be the positioned element. */
  style?: CSSProperties
  /** One media element. It receives the object-position; the box gives it cover. */
  children: (style: CSSProperties) => ReactElement
}) {
  // A computed position, not a design value: there is no token for "the
  // subject is 73% of the way across".
  const style: CSSProperties = { objectPosition: objectPositionFor(composition, sourceAspectRatio) }
  return (
    <AspectRatio
      ratio={ratioFromLabel(composition.aspectRatio, 9 / 16)}
      fit={fitFor(composition, finished)}
      className={className}
      style={frameStyle}
    >
      {children(style)}
    </AspectRatio>
  )
}

/** The composition a moment has before the server has decided one: centred, in the request's shape. */
export function centredComposition(aspectRatio: string): Composition {
  return { aspectRatio, mode: "original", focalX: null, focalY: null, focusPct: 50, crop: null }
}
