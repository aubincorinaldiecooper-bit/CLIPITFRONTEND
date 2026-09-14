import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ResultsStage } from "../components/moments/results-stage"
import type { Exchange } from "../components/start/types"
import { exchange, match, moments, video } from "./support/moments"

/**
 * The results stage — the second screen of the owner's prototype
 * (2026-09-14) — says what was asked and what the search said about it,
 * and puts the moments on a ring with one in the centre playing.
 */
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

describe("ResultsStage — what was asked, and what came of it", () => {
  it("shows the question, the count the server returned, and the moment in the centre playing from the source", () => {
    renderStage(exchange({ matches: [match({ id: "a" }), match({ id: "b", confidence: 0.5, description: "The dunk" })] }))
    expect(screen.getByTestId("stage-question").textContent).toBe("find the harbour")
    expect(screen.getByTestId("stage-words").textContent).toBe("Found 2 moments.")
    // The strongest moment is in the centre, and it plays the moment from the source.
    const player = screen.getByTestId("moment-video") as HTMLVideoElement
    expect(player.getAttribute("src")).toBe("https://cdn.test/proxy.mp4?sig=1#t=10")
    expect(screen.getByTestId("stage-caption").textContent).toContain("Harbour skyline")
    expect(screen.getByTestId("stage-caption").textContent).toContain("0:10–0:34 · seen")
    // The neighbour is a still, not a second player.
    expect(screen.getAllByTestId("moment-video")).toHaveLength(1)
  })

  it("counts only what the server returned, and says so plainly when that is nothing", () => {
    renderStage(exchange({ matches: [] }))
    expect(screen.getByTestId("stage-words").textContent).toBe("I couldn't find a clear moment where that happens. Try describing it another way.")
    expect(screen.queryByRole("region", { name: "Moments found" })).toBeNull()
  })

  it("names a stretch it could not look at, so silence is never read as absence", () => {
    renderStage(
      exchange({
        matches: [match()],
        coverage: { complete: false, locatable: true, unsearchedSeconds: 90, gaps: [{ startSeconds: 60, endSeconds: 150, startTimecode: "1:00", endTimecode: "2:30", reason: "provider_refused" }], degraded: [] },
      }),
    )
    expect(screen.getByTestId("stage-words").textContent).toContain("I couldn't look at 1m 30s of this video (1:00–2:30), so I'd have missed anything there.")
  })

  it("while the search runs, says what it is doing and what it has found so far — as so far — and where the moments will land", () => {
    renderStage(
      exchange({
        status: "searching",
        matches: [],
        progress: { stage: "search", percent: 20, chunksTotal: 5, chunksCompleted: 2, chunksFailed: 0, message: "Reading 1 of 5", candidatesFound: 3 },
      }),
    )
    expect(screen.getByText("Looking for")).toBeTruthy()
    expect(screen.getByTestId("stage-words").textContent).toContain("Watching the footage — 2 of 5 parts…")
    expect(screen.getByTestId("stage-words").textContent).toContain("3 possible moments so far…")
    expect(document.body.textContent).not.toContain("Found 3")
    expect(document.body.textContent).not.toContain("Reading 1 of 5")
    expect(screen.getByTestId("stage-searching")).toBeTruthy()
  })

  it("reports the moment in the centre, and nothing once it has gone", async () => {
    const onActiveChange = vi.fn()
    const { unmount } = renderStage(exchange({ matches: [match({ id: "a" }), match({ id: "b", confidence: 0.5 })] }), { onActiveChange })
    await waitFor(() => expect(onActiveChange).toHaveBeenCalled())
    expect(onActiveChange.mock.calls.at(-1)![0]?.match.id).toBe("a")
    unmount()
    expect(onActiveChange.mock.calls.at(-1)![0]).toBeUndefined()
  })

  it("opens on the moment it was left on, and Open moment leads to that moment's own page", async () => {
    const onOpen = vi.fn()
    renderStage(exchange({ matches: [match({ id: "a" }), match({ id: "b", confidence: 0.5, description: "The dunk" })] }), { initialMomentId: "b", onOpen })
    expect(screen.getByTestId("stage-caption").textContent).toContain("The dunk")
    const open = screen.getByRole("link", { name: "Open moment" })
    expect(open.getAttribute("href")).toBe("/start?video=video-1&search=req-1&moment=b")
    await userEvent.click(open)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen.mock.calls[0]![0].match.id).toBe("b")
  })

  it("keeps the same moment in the centre when a stronger one lands above it", async () => {
    const onActiveChange = vi.fn()
    const first = exchange({ matches: [match({ id: "a" })] })
    const { rerender } = renderStage(first, { onActiveChange })
    await waitFor(() => expect(onActiveChange.mock.calls.at(-1)![0]?.match.id).toBe("a"))
    const grown = exchange({ matches: [match({ id: "z", confidence: 0.99, description: "Stronger" }), match({ id: "a" })] })
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
    await waitFor(() => expect(screen.getByTestId("stage-caption").textContent).toContain("Harbour skyline"))
  })

  it("hides the arrows with one moment, without moving Open moment", () => {
    renderStage(exchange({ matches: [match()] }))
    expect(screen.getByRole("button", { name: "Previous moment" }).className).toContain("invisible")
    expect(screen.getByRole("button", { name: "Next moment" }).className).toContain("invisible")
  })

  it("offers the other questions asked of this video", async () => {
    const onPickOther = vi.fn()
    renderStage(exchange(), { others: [{ id: "req-2", instruction: "every goal" }], onPickOther })
    await userEvent.click(screen.getByRole("button", { name: "every goal" }))
    expect(onPickOther).toHaveBeenCalledWith("req-2")
  })
})
