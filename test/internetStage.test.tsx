import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { InternetStage, MAX_SLOTS } from "../components/moments/internet-stage"
import type { InternetMoment } from "../lib/types"

afterEach(cleanup)

const moment = (overrides: Partial<InternetMoment> = {}): InternetMoment => ({
  id: "m1",
  description: "Kai Cenat walks the runway",
  startSeconds: 10,
  endSeconds: 34,
  still: null,
  source: "youtube.com",
  ...overrides,
})

const many = (count: number): InternetMoment[] =>
  Array.from({ length: count }, (_, index) => moment({ id: `m${index + 1}`, description: `Moment ${index + 1}` }))

function pending() {
  return screen.queryAllByTestId("moment-slot-pending")
}

function filled() {
  return screen.queryAllByTestId("moment-slot-filled")
}

describe("the internet results stage", () => {
  it("shows a loading screen first, whatever the search is about to find", () => {
    render(<InternetStage query="kai cenat's fashion show" phase="loading" moments={[]} />)

    expect(screen.getByTestId("internet-loading")).toBeTruthy()
    expect(screen.getByTestId("internet-question").textContent).toBe("kai cenat's fashion show")
    expect(screen.getByTestId("internet-words").textContent).toBe("Searching the internet.")
    // No band and no skeletons: a skeleton promises a card is on its way,
    // and until the search has found a page there is nothing to promise.
    expect(pending()).toHaveLength(0)
    expect(screen.queryByRole("region", { name: "Moments found on the internet" })).toBeNull()
  })

  it("puts up skeletons only once there is something to watch", () => {
    render(<InternetStage query="a dog on a skateboard" phase="searching" moments={[]} />)

    expect(screen.queryByTestId("internet-loading")).toBeNull()
    expect(screen.getByTestId("internet-words").textContent).toBe("Watching what the search turned up.")
    expect(pending()).toHaveLength(MAX_SLOTS)
    expect(filled()).toHaveLength(0)
  })

  it("gives each moment found a slot and leaves the rest as skeletons", () => {
    render(<InternetStage query="a dog on a skateboard" phase="searching" moments={many(2)} />)

    expect(filled()).toHaveLength(2)
    expect(pending()).toHaveLength(MAX_SLOTS - 2)
  })

  it("takes away the slots nothing filled once the search is over", () => {
    render(<InternetStage query="a dog on a skateboard" phase="answered" moments={many(2)} />)

    expect(filled()).toHaveLength(2)
    // Two moments are two cards. An empty slot at the end of a search is not
    // a moment still coming.
    expect(pending()).toHaveLength(0)
    expect(screen.getByTestId("internet-words").textContent).toBe("2 moments fit your search.")
  })

  it("treats one result as a whole answer", () => {
    render(<InternetStage query="the only time it happens" phase="answered" moments={many(1)} />)

    expect(filled()).toHaveLength(1)
    expect(pending()).toHaveLength(0)
    expect(screen.getByTestId("internet-words").textContent).toBe("1 moment fits your search.")
  })

  it("says plainly when the search found nothing", () => {
    render(<InternetStage query="something nobody filmed" phase="answered" moments={[]} />)

    expect(screen.getByTestId("internet-words").textContent).toBe("No results fit your search.")
    expect(pending()).toHaveLength(0)
    expect(filled()).toHaveLength(0)
    expect(screen.queryByRole("region", { name: "Moments found on the internet" })).toBeNull()
  })

  it("holds five at most, and still says how many were really found", () => {
    render(<InternetStage query="every time someone laughs" phase="answered" moments={many(7)} />)

    // Five is a ceiling on what the band shows, not a cap on what was found,
    // and the sentence must not quietly report the smaller number.
    expect(filled()).toHaveLength(MAX_SLOTS)
    expect(screen.getByTestId("internet-words").textContent).toBe("7 moments fit your search. The strongest 5 are here.")
  })

  it("captions the moment in the centre with its own words and its own stretch", () => {
    render(<InternetStage query="the runway" phase="answered" moments={[moment()]} />)

    const caption = screen.getByTestId("internet-caption").textContent ?? ""
    expect(caption).toContain("Kai Cenat walks the runway")
    expect(caption).toContain("0:10–0:34")
    expect(caption).toContain("youtube.com")
  })

  it("never shows a skeleton that claims to know anything", () => {
    render(<InternetStage query="anything" phase="searching" moments={[]} />)

    for (const slot of pending()) {
      expect(slot.textContent).toBe("")
      expect(slot.getAttribute("aria-hidden")).toBe("true")
    }
  })
})
