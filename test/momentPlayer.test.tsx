import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MomentPlayer } from "../components/moments/moment-player"
import { exchange, match, moments, video } from "./support/moments"

/**
 * The player plays exactly the moment: the source seeked to its start,
 * looping inside it, keyed by the FILE so a re-signed link does not restart
 * it and a re-cut's new file does.
 */
afterEach(cleanup)

const first = (list: ReturnType<typeof moments>) => list[0]!

describe("MomentPlayer", () => {
  it("plays the moment from the source, with the time within the moment", () => {
    render(<MomentPlayer moment={first(moments([exchange()]))} video={video} muted onMutedChange={vi.fn()} />)
    const element = screen.getByTestId("moment-video") as HTMLVideoElement
    expect(element.getAttribute("src")).toBe("https://cdn.test/proxy.mp4?sig=1#t=10")
    expect(element.loop).toBe(false)
    expect(screen.getByTestId("moment-time").textContent).toBe("0:00 / 0:24")
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy()
    expect(screen.getByText("harbour.mp4")).toBeTruthy()
  })

  it("plays the moment, then the moment again — never the rest of the video", () => {
    render(<MomentPlayer moment={first(moments([exchange()]))} video={video} muted onMutedChange={vi.fn()} />)
    const element = screen.getByTestId("moment-video") as HTMLVideoElement
    element.currentTime = 20
    fireEvent.timeUpdate(element)
    expect(screen.getByTestId("moment-time").textContent).toBe("0:10 / 0:24")
    element.currentTime = 34
    fireEvent.timeUpdate(element)
    expect(element.currentTime).toBe(10)
  })

  it("keeps playing the link it started with while the page re-signs it, and takes the new one only when the old fails", () => {
    const one = exchange()
    const { rerender } = render(<MomentPlayer moment={first(moments([one]))} video={video} muted onMutedChange={vi.fn()} />)
    const resigned = { ...video, playback: { url: "https://cdn.test/source.mp4?sig=2", expiresAt: "", proxyUrl: "https://cdn.test/proxy.mp4?sig=2" } }
    rerender(<MomentPlayer moment={first(moments([one], resigned))} video={resigned} muted onMutedChange={vi.fn()} />)
    const element = screen.getByTestId("moment-video") as HTMLVideoElement
    expect(element.getAttribute("src")).toBe("https://cdn.test/proxy.mp4?sig=1#t=10")
    fireEvent.error(element)
    expect((screen.getByTestId("moment-video") as HTMLVideoElement).getAttribute("src")).toBe("https://cdn.test/proxy.mp4?sig=2#t=10")
  })

  it("says what was decided on the picture, and holds it while the system reworks it", () => {
    render(<MomentPlayer moment={first(moments([exchange({ matches: [match({ feedback: "approved", clip: { id: "c", status: "generating" } })] })]))} video={video} muted onMutedChange={vi.fn()} />)
    expect(screen.getByTestId("moment-decision").textContent).toBe("Kept · cutting…")
    cleanup()
    render(<MomentPlayer moment={first(moments([exchange({ matches: [match({ reclipStatus: "pending" })] })]))} video={video} muted onMutedChange={vi.fn()} />)
    expect(screen.getByTestId("reworking-overlay")).toBeTruthy()
  })

  it("shows the still and no controls when there is nothing to play yet", () => {
    const unplayable = { ...video, playback: null }
    render(<MomentPlayer moment={first(moments([exchange()], unplayable))} video={unplayable} muted onMutedChange={vi.fn()} />)
    expect(screen.queryByTestId("moment-video")).toBeNull()
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull()
    expect(screen.getByTestId("moment-time").textContent).toBe("0:24")
  })

  it("sound is one setting for the screen: the mute control reports the change up", () => {
    const onMutedChange = vi.fn()
    render(<MomentPlayer moment={first(moments([exchange()]))} video={video} muted onMutedChange={onMutedChange} />)
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Unmute" }))
    })
    expect(onMutedChange).toHaveBeenCalledWith(false)
  })

  it("the compact card has no scrubber and no fullscreen", () => {
    render(<MomentPlayer compact moment={first(moments([exchange()]))} video={video} muted onMutedChange={vi.fn()} />)
    expect(screen.queryByRole("slider")).toBeNull()
    expect(screen.queryByRole("button", { name: "Expand" })).toBeNull()
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy()
  })
})
