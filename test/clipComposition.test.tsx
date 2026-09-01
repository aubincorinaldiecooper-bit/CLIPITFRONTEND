import { describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { ClipComposition, centredComposition, fitFor, objectPositionFor, ratioFromLabel } from "../components/media/clip-composition"
import type { ClipComposition as Composition } from "../lib/types"

/**
 * The card and the Preview must not independently work out where a moment
 * sits in its box. Both take the server's composition through here, so the
 * one thing these tests hold is that the same numbers give the same box and
 * the same position — and that a landscape moment is never forced portrait.
 */

const smartCrop = (over: Partial<Composition> = {}): Composition => ({
  aspectRatio: "9:16",
  mode: "smart_crop",
  focalX: 0.75,
  focalY: 0.5,
  focusPct: 75,
  crop: { x: 0.5922, y: 0, width: 0.3156, height: 1 },
  ...over,
})

describe("ratioFromLabel", () => {
  it("reads the labels the server sends", () => {
    expect(ratioFromLabel("9:16", 1)).toBeCloseTo(9 / 16)
    expect(ratioFromLabel("16:9", 1)).toBeCloseTo(16 / 9)
    expect(ratioFromLabel("source", 4 / 3)).toBeCloseTo(4 / 3)
    expect(ratioFromLabel(null, 4 / 3)).toBeCloseTo(4 / 3)
  })
})

describe("objectPositionFor", () => {
  it("slides along x when the crop narrowed a landscape source", () => {
    expect(objectPositionFor(smartCrop(), "16:9")).toBe("75% 50%")
  })

  it("slides along y when the crop shortened a portrait source", () => {
    expect(objectPositionFor(smartCrop({ aspectRatio: "16:9", crop: { x: 0, y: 0.3, width: 1, height: 0.5625 }, focusPct: 60 }), "9:16")).toBe("50% 60%")
  })

  it("is centred when nothing was cut", () => {
    expect(objectPositionFor(centredComposition("9:16"), "9:16")).toBe("50% 50%")
    expect(objectPositionFor(smartCrop({ crop: null, focusPct: 50 }), "16:9")).toBe("50% 50%")
  })

  it("tells the axis from the ratios before a crop has been decided", () => {
    const pending = centredComposition("9:16")
    expect(objectPositionFor({ ...pending, focusPct: 30 }, "16:9")).toBe("30% 50%")
  })
})

describe("ClipComposition", () => {
  it("gives the box the composition's ratio and the media its position", () => {
    cleanup()
    const { container } = render(
      <ClipComposition composition={smartCrop()} sourceAspectRatio="16:9">
        {(style) => <img data-testid="media" alt="" style={style} />}
      </ClipComposition>,
    )
    const box = container.firstElementChild as HTMLElement
    const [w, h] = box.style.aspectRatio.split("/").map((part) => Number(part.trim()))
    expect(w / (h || 1)).toBeCloseTo(9 / 16, 6)
    expect((screen.getByTestId("media") as HTMLElement).style.objectPosition).toBe("75% 50%")
  })

  it("keeps a landscape moment landscape — nothing is forced to 9:16", () => {
    cleanup()
    const { container } = render(
      <ClipComposition composition={{ ...centredComposition("16:9") }} sourceAspectRatio="16:9">
        {(style) => <video data-testid="media" style={style} />}
      </ClipComposition>,
    )
    const box = container.firstElementChild as HTMLElement
    const [w, h] = box.style.aspectRatio.split("/").map((part) => Number(part.trim()))
    expect(w / (h || 1)).toBeCloseTo(16 / 9, 6)
  })
})

describe("fitFor — raw source is never shown through a crop the export will not make", () => {
  it("covers with a finished file, whatever its mode", () => {
    expect(fitFor(smartCrop(), true)).toBe("cover")
    expect(fitFor(smartCrop({ mode: "blurred_background", crop: null }), true)).toBe("cover")
    expect(fitFor(centredComposition("9:16"), true)).toBe("cover")
  })

  it("covers raw source only for a smart crop, which cover + position reproduces exactly", () => {
    expect(fitFor(smartCrop(), false)).toBe("cover")
  })

  it("keeps the whole frame for a padded or blurred delivery, and for an undecided vertical moment", () => {
    expect(fitFor(smartCrop({ mode: "blurred_background", crop: null, focusPct: 50 }), false, "16:9")).toBe("contain")
    expect(fitFor(smartCrop({ mode: "padded", crop: null, focusPct: 50 }), false, "16:9")).toBe("contain")
    expect(fitFor(centredComposition("9:16"), false, "16:9")).toBe("contain")
  })

  it("keeps the whole frame for any delivery shape that is not the source's — square included", () => {
    expect(fitFor(smartCrop({ aspectRatio: "1:1", mode: "padded", crop: null, focusPct: 50 }), false, "16:9")).toBe("contain")
    expect(fitFor(smartCrop({ aspectRatio: "1:1", mode: "blurred_background", crop: null, focusPct: 50 }), false, "9:16")).toBe("contain")
    // Unknown source: nothing can be assumed cut-safe, so the whole frame.
    expect(fitFor(centredComposition("9:16"), false, null)).toBe("contain")
  })

  it("covers a moment whose box is the source's own shape — nothing is cut either way", () => {
    expect(fitFor(centredComposition("16:9"), false, "16:9")).toBe("cover")
    expect(fitFor(centredComposition("1:1"), false, "1:1")).toBe("cover")
  })
})
