import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ResultsStage } from "../components/moments/results-stage"
import type { Exchange } from "../components/start/types"
import { exchange, match, moments, video } from "./support/moments"

function renderStage(
  one: Exchange,
  props: Partial<React.ComponentProps<typeof ResultsStage>> = {},
) {
  const list = moments([one])
  const utils = render(
    <ResultsStage
      exchange={one}
      video={video}
      moments={list}
      followUp={false}
      momentHref={(moment) => `/start?video=video-1&search=${moment.requestId}&moment=${moment.match.id}`}
      onOpen={vi.fn()}
      muted
      onMutedChange={vi.fn()}
      {...props}
    />,
  )
  return { ...utils, list }
}

afterEach(cleanup)

describe("ResultsStage — AI Chat 04 reference shell", () => {
  it("draws the reference shell: left navigation, central results, right search chat", () => {
    renderStage(exchange({ matches: [match()] }))
    expect(screen.getByRole("link", { name: "New search" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Library" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Shared" })).toBeTruthy()
    expect(screen.getByText("Results")).toBeTruthy()
    expect(screen.getByText("Search chat")).toBeTruthy()
    expect(screen.getByTestId("stage-question").textContent).toBe("find the harbour")
  })

  it("stacks results vertically and only plays the selected result", () => {
    renderStage(exchange({ matches: [
      match({ id: "a" }),
      match({ id: "b", confidence: 0.5, description: "The dunk" }),
    ] }))

    expect(screen.getAllByRole("link", { name: "Open moment" })).toHaveLength(2)
    expect(screen.getAllByTestId("moment-video")).toHaveLength(1)
    expect(screen.getByTestId("stage-caption").textContent).toContain("Harbour skyline")
  })

  it("keeps server search language in the right chat panel", () => {
    renderStage(exchange({ matches: [match({ id: "a" }), match({ id: "b" })] }))
    expect(screen.getByTestId("stage-words").textContent).toBe("Found 2 moments.")
  })

  it("shows stacked skeletons while the search is running", () => {
    renderStage(
      exchange({
        status: "searching",
        matches: [],
        progress: {
          stage: "search",
          percent: 20,
          chunksTotal: 5,
          chunksCompleted: 2,
          chunksFailed: 0,
          message: "Reading 1 of 5",
          candidatesFound: 3,
        },
      }),
    )
    expect(screen.getByTestId("stage-searching")).toBeTruthy()
    expect(screen.getByTestId("stage-words").textContent).toContain("Watching the footage — 2 of 5 parts…")
    expect(screen.getByTestId("stage-words").textContent).toContain("3 possible moments so far…")
  })

  it("opens on the requested moment and preserves that selection when results reorder", async () => {
    const onActiveChange = vi.fn()
    const first = exchange({ matches: [match({ id: "a" }), match({ id: "b", confidence: 0.5, description: "The dunk" })] })
    const { rerender } = renderStage(first, { initialMomentId: "b", onActiveChange })

    await waitFor(() => expect(onActiveChange.mock.calls.at(-1)![0]?.match.id).toBe("b"))
    expect(screen.getByTestId("stage-caption").textContent).toContain("The dunk")

    const grown = exchange({
      matches: [
        match({ id: "z", confidence: 0.99, description: "Stronger" }),
        match({ id: "a" }),
        match({ id: "b", confidence: 0.5, description: "The dunk" }),
      ],
    })

    rerender(
      <ResultsStage
        exchange={grown}
        video={video}
        moments={moments([grown])}
        followUp={false}
        momentHref={() => "#"}
        onOpen={vi.fn()}
        onActiveChange={onActiveChange}
        muted
        onMutedChange={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByTestId("stage-caption").textContent).toContain("The dunk"))
  })

  it("opens a result's dedicated moment page", async () => {
    const onOpen = vi.fn()
    renderStage(exchange({ matches: [match({ id: "a" })] }), { onOpen })
    const open = screen.getByRole("link", { name: "Open moment" })
    expect(open.getAttribute("href")).toBe("/start?video=video-1&search=req-1&moment=a")
    await userEvent.click(open)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it("offers previous questions in the reference rail and chat panel", async () => {
    const onPickOther = vi.fn()
    renderStage(exchange(), { others: [{ id: "req-2", instruction: "every goal" }], onPickOther })
    const choices = screen.getAllByRole("button", { name: "every goal" })
    expect(choices.length).toBeGreaterThan(0)
    await userEvent.click(choices[0]!)
    expect(onPickOther).toHaveBeenCalledWith("req-2")
  })
})
