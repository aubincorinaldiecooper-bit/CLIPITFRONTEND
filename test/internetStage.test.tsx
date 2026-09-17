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

    // Five is a ceiling on what the band shows, not a cap on what was found,
    // and the sentence must not quietly report the smaller number.
    expect(filled()).toHaveLength(MAX_SLOTS)
    expect(screen.getByTestId("internet-words").textContent).toBe("7 videos fit your search. The strongest 5 are here.")
  })

  it("badges how sure the watcher said it was, and says nothing when it did not", () => {
    render(<InternetStage query="the runway" phase="answered" moments={[moment({ confidence: 0.82 })]} />)
    expect(screen.getByTestId("moment-slot-filled").textContent).toContain("82% sure")
    cleanup()

    // The ordinary case. The watcher is asked to say and does not have to,
    // and a number invented to fill that gap would be the most misleading
    // thing on the screen.
    render(<InternetStage query="the runway" phase="answered" moments={[moment()]} />)
    expect(screen.getByTestId("moment-slot-filled").textContent).not.toContain("sure")
    cleanup()

    // Zero is an answer, and not the same as saying nothing.
    render(<InternetStage query="the runway" phase="answered" moments={[moment({ confidence: 0 })]} />)
    expect(screen.getByTestId("moment-slot-filled").textContent).toContain("0% sure")
  })

  it("never calls it accuracy, because nothing has measured that", () => {
    render(<InternetStage query="the runway" phase="answered" moments={[moment({ confidence: 0.82 })]} />)
    // It is the watcher's opinion of its own reading. Accuracy would be how
    // often it turns out to be right, which has never been scored here.
    expect(screen.getByTestId("internet-stage").textContent).not.toMatch(/accura/i)
  })

  it("captions the video in the centre with its title and its site, and no clocks", () => {
    render(<InternetStage query="the runway" phase="answered" moments={[moment()]} />)

    const caption = screen.getByTestId("internet-caption").textContent ?? ""
    expect(caption).toContain("Kai Cenat walks the runway")
    // The site the video is on, named the way a person says it — not the
    // search engine that turned it up, which is what `source` carries.
    expect(caption).toContain("YouTube")
    // Where in the video to look belongs on the video, where it can be
    // jumped to. A row of raw clocks beside the picture is not what this
    // line is for (the owner, 2026-09-16).
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

    // One card, not three: the same video three times would take three of
    // the five slots and bury whatever else the search found.
    expect(filled()).toHaveLength(1)
    expect(screen.getByTestId("internet-words").textContent).toBe("1 video fits your search.")
    // Where it stands in the band is what says how strongly it answered.
    // Nothing on the picture claims to measure that.
    const caption = screen.getByTestId("internet-caption").textContent ?? ""
    expect(caption).toContain("The whole show")
    expect(caption).not.toMatch(/\d+:\d\d/)
  })

  it("gives the caption the same room whatever is in it, so the arrows never move", () => {
    // The arrows sit directly under the caption. A caption that grew with a
    // longer title or with more approved places would move them every time
    // the band was turned — the reflow AGENTS.md rules out.
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

    // Same box, same number of lines in it, however much there is to say.
    expect(crowded.className).toBe(one.className)
    expect(crowded.lines).toBe(one.lines)
    expect(one.lines).toBe(2)

    // And the two lines cannot become four. jsdom does no layout, so the
    // only way to hold this is on the rules that decide it: the title is
    // clamped and the places are cut off rather than wrapped onto a second
    // row. A wrapping row here is the bug, and it looks fine until a video
    // with several approved places reaches a narrow screen.
    render(<InternetStage query="the runway" phase="answered" moments={[moment()]} />)
    const [title, places] = Array.from(screen.getByTestId("internet-caption-words").querySelectorAll("p"))
    expect(title!.className).toContain("line-clamp-2")
    expect(places!.className).toContain("truncate")
    expect(places!.className).not.toContain("flex-wrap")
  })

  it("keeps the moment you are looking at when a stronger one lands above it", async () => {
    // Moments arrive while the band is on screen, strongest first. A
    // stronger one taking a place above the centred card must not make the
    // centre silently become whatever moved into that position.
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
    // Centre the first empty slot, then let a moment land in it. The person
    // was watching that place in the band; what arrives there is what they
    // should see, not the skeleton that shuffled along behind it.
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

    // The centred slot is a skeleton, so there is nothing to caption — but
    // the block keeps its room and the arrows stay, or the band jumps up the
    // screen and the way back disappears with it.
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
