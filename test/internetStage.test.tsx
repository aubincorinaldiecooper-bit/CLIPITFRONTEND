import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
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
    moment({
      id: `m${index + 1}`,
      pageUrl: `https://www.youtube.com/watch?v=m${index + 1}`,
      title: `Video ${index + 1}`,
    }),
  )

describe("InternetStage — AI Chat 04 reference shell", () => {
  it("draws the same three-column results shell as uploaded-video search", () => {
    render(<InternetStage query="kai cenat's fashion show" phase="answered" moments={[moment()]} />)
    expect(screen.getByRole("link", { name: "New search" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Library" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Shared" })).toBeTruthy()
    expect(screen.getByText("Internet results")).toBeTruthy()
    expect(screen.getByText("Search chat")).toBeTruthy()
    expect(screen.getByTestId("internet-question").textContent).toBe("kai cenat's fashion show")
  })

  it("shows five neutral result skeletons while searching", () => {
    render(<InternetStage query="a dog on a skateboard" phase="searching" moments={[]} />)
    expect(screen.queryAllByTestId("moment-slot-pending")).toHaveLength(MAX_SLOTS)
    expect(screen.queryAllByTestId("moment-slot-filled")).toHaveLength(0)
    expect(screen.getByTestId("internet-words").textContent).toBe("Watching what the search turned up.")
  })

  it("fills result rows progressively and removes unused skeletons when finished", () => {
    const { rerender } = render(<InternetStage query="q" phase="searching" moments={many(2)} />)
    expect(screen.queryAllByTestId("moment-slot-filled")).toHaveLength(2)
    expect(screen.queryAllByTestId("moment-slot-pending")).toHaveLength(MAX_SLOTS - 2)

    rerender(<InternetStage query="q" phase="answered" moments={many(2)} />)
    expect(screen.queryAllByTestId("moment-slot-filled")).toHaveLength(2)
    expect(screen.queryAllByTestId("moment-slot-pending")).toHaveLength(0)
    expect(screen.getByTestId("internet-words").textContent).toBe("2 videos fit your search.")
  })

  it("caps the visible result list at five while preserving the real count in the status", () => {
    render(<InternetStage query="q" phase="answered" moments={many(7)} />)
    expect(screen.queryAllByTestId("moment-slot-filled")).toHaveLength(MAX_SLOTS)
    expect(screen.getByTestId("internet-words").textContent).toBe("7 videos fit your search. The strongest 5 are here.")
  })

  it("renders match confidence only when the watcher supplied it", () => {
    const { rerender } = render(<InternetStage query="q" phase="answered" moments={[moment({ confidence: 0.82 })]} />)
    expect(screen.getByLabelText("82% match")).toBeTruthy()

    rerender(<InternetStage query="q" phase="answered" moments={[moment()]} />)
    expect(screen.queryByText("match")).toBeNull()
  })

  it("never turns a total watch failure into 'No results'", () => {
    render(
      <InternetStage
        query="q"
        phase="failed"
        moments={[]}
        outcome="watch_failed"
        failure={{ kind: "video_model_unavailable", count: 28 }}
        candidatesFound={7}
        candidatesWatched={0}
      />,
    )
    const said = screen.getByTestId("internet-words").textContent ?? ""
    expect(said).not.toContain("No results fit your search.")
    expect(said).toContain("could not watch any of them")
    expect(said).toContain("7 videos")
  })

  it("keeps partial watching honest rather than claiming exhaustive absence", () => {
    render(
      <InternetStage
        query="q"
        phase="answered"
        moments={[]}
        outcome="partly_watched"
        candidatesFound={7}
        candidatesWatched={3}
      />,
    )
    const said = screen.getByTestId("internet-words").textContent ?? ""
    expect(said).not.toContain("No results fit your search.")
    expect(said).toContain("4 videos could not be watched")
    expect(said).toContain("there may be more")
  })

  it("distinguishes discovery finding nothing from a completed watch finding no match", () => {
    const { rerender } = render(
      <InternetStage query="q" phase="answered" moments={[]} outcome="no_candidates" candidatesFound={0} candidatesWatched={0} />,
    )
    expect(screen.getByTestId("internet-words").textContent).toBe("The search turned up no videos to watch.")

    rerender(
      <InternetStage query="q" phase="answered" moments={[]} outcome="no_matches" candidatesFound={4} candidatesWatched={4} />,
    )
    expect(screen.getByTestId("internet-words").textContent).toBe("No results fit your search.")
  })

  it("says a failed mission did not finish and does not leak infrastructure wording", () => {
    render(
      <InternetStage
        query="q"
        phase="failed"
        moments={many(2)}
        outcome="search_failed"
        failure={{ kind: "browser_unavailable", count: 1 }}
        candidatesFound={7}
      />,
    )
    const said = screen.getByTestId("internet-words").textContent ?? ""
    expect(said).toContain("stopped before it finished")
    expect(said).toContain("not an answer about what is in the videos")
    for (const leak of ["stalled", "BullMQ", "Modal", "queue"]) expect(said).not.toContain(leak)
    expect(screen.queryAllByTestId("moment-slot-filled")).toHaveLength(2)
  })
})
