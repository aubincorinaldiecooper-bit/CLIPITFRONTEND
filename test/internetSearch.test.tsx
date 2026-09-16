import { describe, expect, it } from "vitest"
import { askGate, askTarget } from "../components/start/ask-gate"

/**
 * Asking the internet instead of a video.
 *
 * What the results of that question look like is the stage's own test
 * (internetStage.test.tsx). This is about the box: a question with nothing
 * attached is a question for the internet, and the Search button takes it.
 */
describe("asking the internet instead of a video", () => {
  it("is what the box does when nothing is attached", () => {
    expect(askTarget(null)).toBe("internet")
    expect(askGate(null).accepting).toBe(true)
  })

  it("waits for the video when one is on its way", () => {
    // Anything in the tray means a video was meant, even a pick that failed,
    // so the words are not quietly sent to the web instead.
    expect(askTarget(null, { attaching: true })).toBe("video")
    expect(askGate(null, { attaching: true }).accepting).toBe(false)
  })
})
