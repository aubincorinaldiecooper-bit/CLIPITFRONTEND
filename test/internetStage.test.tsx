import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { InternetStage, MAX_SLOTS } from "../components/moments/internet-stage"
import type { InternetMoment } from "../lib/types"

afterEach(cleanup)

const moment = (overrides: Partial<InternetMoment> = {}): InternetMoment => ({
  id: "m1",
  pageUrl: "https://www.youtube.com/watch?v=m1",
  title: "Kai Cenat walks the runway",
  still: null,
  source: "youtube.com",
  marks: [{ startSeconds: 10, endSeconds: 34, description: "Kai Cenat walks the runway" }],
  ...overrides,
})

const many = (count: number): InternetMoment[] =>
  Array.from({ length: count }, (_, index) =>
    moment({ id: `m${index + 1}`, pageUrl: `https://www.youtube.com/watch?v=m${index + 1}`, title: `Video ${index + 1}` }),
  )

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
    expect(pending()).toHaveLength(0)
    expect(screen.getByTestId("internet-words").textContent).toBe("2 videos fit your search.")
  })

  it("treats one result as a whole answer", () => {
    render(<InternetStage query="the only time it happens" phase="answered" moments={many(1)} />)

    expect(filled()).toHaveLength(1)
    expect(pending()).toHaveLength(0)
    expect(screen.getByTestId("internet-words").textContent).toBe("1 video fits your search.")
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

    expect(filled()).toHaveLength(MAX_SLOTS)
    expect(screen.getByTestId("internet-words").textContent).toBe("7 videos fit your search. The strongest 5 are here.")
  })

  it("shows the animated match badge only when the watcher supplied confidence", () => {
    render(<InternetStage query="the runway" phase="answered" moments={[moment({ confidence: 0.82 })]} />)
    expect(screen.getByLabelText("82% match")).toBeTruthy()
    expect(screen.getByTestId("moment-slot-filled").textContent).toContain("match")
    cleanup()

    render(<InternetStage query="the runway" phase="answered" moments={[moment()]} />)
    expect(screen.queryByText("match")).toBeNull()
    cleanup()

    render(<InternetStage query="the runway" phase="answered" moments={[moment({ confidence: 0 })]} />)
    expect(screen.getByLabelText("0% match")).toBeTruthy()
  })

  it("never calls the confidence badge accuracy", () => {
    render(<InternetStage query="the runway" phase="answered" moments={[moment({ confidence: 0.82 })]} />)
    expect(screen.getByTestId("internet-stage").textContent).not.toMatch(/accura/i)
  })

  it("captions the video in the centre with its title and its site, and no clocks", () => {
    render(<InternetStage query="the runway" phase="answered" moments={[moment()]} />)

    const caption = screen.getByTestId("internet-caption").textContent ?? ""
    expect(caption).toContain("Kai Cenat walks the runway")
    expect(caption).toContain("YouTube")
    expect(caption).not.toMatch(/\d+:\d\d/)
  })

  it("gives a video approved in several places one card offering all of them", () => {
    const thrice = moment({
      id: "thrice",
      title: "The whole show",
      marks: [
        { startSeconds: 10, endSeconds: 14, description: "He walks out." },
        { startSeconds: 40, endSeconds: 43, description: "He turns." },
        { startSeconds: 70, endSeconds: 75, description: "He walks back." },
      ],
    })
    render(<InternetStage query="the runway" phase="answered" moments={[thrice]} />)

    expect(filled()).toHaveLength(1)
    expect(screen.getByTestId("internet-words").textContent).toBe("1 video fits your search.")
    const caption = screen.getByTestId("internet-caption").textContent ?? ""
    expect(caption).toContain("The whole show")
    expect(caption).not.toMatch(/\d+:\d\d/)
  })

  it("gives the caption the same room whatever is in it, so the arrows never move", () => {
    const room = (moments: InternetMoment[]) => {
      render(<InternetStage query="the runway" phase="answered" moments={moments} />)
      const box = screen.getByTestId("internet-caption-room")
      const lines = screen.getByTestId("internet-caption-words").querySelectorAll("p")
      const shape = { className: box.className, lines: lines.length }
      cleanup()
      return shape
    }

    const one = room([moment()])
    const crowded = room([
      moment({
        title: "A title long enough to run past two lines on any screen this band is ever going to be looked at on, and then some",
        marks: Array.from({ length: 9 }, (_, index) => ({
          startSeconds: index * 30,
          endSeconds: index * 30 + 4,
          description: `Place ${index + 1}`,
        })),
      }),
    ])

    expect(crowded.className).toBe(one.className)
    expect(crowded.lines).toBe(one.lines)
    expect(one.lines).toBe(2)

    render(<InternetStage query="the runway" phase="answered" moments={[moment()]} />)
    const [title, places] = Array.from(screen.getByTestId("internet-caption-words").querySelectorAll("p"))
    expect(title!.className).toContain("line-clamp-2")
    expect(places!.className).toContain("truncate")
    expect(places!.className).not.toContain("flex-wrap")
  })

  it("keeps the moment you are looking at when a stronger one lands above it", async () => {
    const a = moment({ id: "a", title: "Video A" })
    const b = moment({ id: "b", title: "Video B" })
    const { rerender } = render(<InternetStage query="q" phase="searching" moments={[a, b]} />)

    await userEvent.click(screen.getByRole("button", { name: "Next moment" }))
    await waitFor(() => expect(screen.getByTestId("internet-caption").textContent).toContain("Video B"))

    const stronger = moment({ id: "c", title: "Video C" })
    rerender(<InternetStage query="q" phase="searching" moments={[stronger, a, b]} />)

    expect(screen.getByTestId("internet-caption").textContent).toContain("Video B")
    expect(screen.getByTestId("internet-caption").textContent).not.toContain("Moment A")
  })

  it("shows the moment that fills the slot you were watching", async () => {
    const { rerender } = render(<InternetStage query="q" phase="searching" moments={many(1)} />)

    await userEvent.click(screen.getByRole("button", { name: "Next moment" }))
    await waitFor(() => expect(screen.queryByTestId("internet-caption-words")).toBeNull())

    const arriving = moment({ id: "new", title: "The video that landed here" })
    rerender(<InternetStage query="q" phase="searching" moments={[...many(1), arriving]} />)

    await waitFor(() =>
      expect(screen.getByTestId("internet-caption").textContent).toContain("The video that landed here"),
    )
  })

  it("keeps the caption's room and the arrows when a skeleton is in the centre", async () => {
    render(<InternetStage query="q" phase="searching" moments={many(1)} />)

    await userEvent.click(screen.getByRole("button", { name: "Next moment" }))

    await waitFor(() => expect(screen.queryByTestId("internet-caption-words")).toBeNull())
    expect(screen.getByTestId("internet-caption")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Next moment" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Previous moment" })).toBeTruthy()
  })

  it("never shows a skeleton that claims to know anything", () => {
    render(<InternetStage query="anything" phase="searching" moments={[]} />)

    for (const slot of pending()) {
      expect(slot.textContent).toBe("")
      expect(slot.getAttribute("aria-hidden")).toBe("true")
    }
  })
})
