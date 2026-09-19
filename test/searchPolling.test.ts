import { describe, expect, it } from "vitest"
import { MAX_FAILURES, nextRead, POLL_MS, RETRY_MS, searchIsRunning } from "../components/start/search-polling"

describe("when to read a running search again", () => {
  it("keeps reading while it is still working", () => {
    expect(nextRead({ failed: false, phase: "loading" })).toBe(POLL_MS)
    expect(nextRead({ failed: false, phase: "searching" })).toBe(POLL_MS)
  })

  it("stops once the search has answered", () => {
    expect(nextRead({ failed: false, phase: "answered" })).toBeNull()
    // A search that gave up is just as finished as one that answered.
    expect(nextRead({ failed: false, phase: "failed" })).toBeNull()
  })

  it("reads again after a read that failed, rather than giving up", () => {
    // The scouts carry on whether or not one request got through. Stopping
    // here would freeze the screen at whatever it last saw and lose every
    // moment found after it.
    expect(nextRead({ failed: true })).toBe(RETRY_MS)
    expect(nextRead({ failed: true, consecutiveFailures: 1 })).toBe(RETRY_MS)
    expect(nextRead({ failed: true, phase: "answered" })).toBe(RETRY_MS)
  })

  it("rides out a run of trouble before giving up on it", () => {
    for (let failures = 1; failures < MAX_FAILURES; failures += 1) {
      expect(nextRead({ failed: true, consecutiveFailures: failures })).toBe(RETRY_MS)
    }
  })

  it("stops asking a search that is never coming back", () => {
    // A failed search answers the same way every time. Retrying forever means
    // asking a dead search how it is doing every few seconds until the tab
    // closes — work nobody benefits from, at both ends.
    expect(nextRead({ failed: true, consecutiveFailures: MAX_FAILURES })).toBeNull()
    expect(nextRead({ failed: true, consecutiveFailures: MAX_FAILURES + 3 })).toBeNull()
  })

  it("gives up only on an unbroken run", () => {
    // One good read puts the count back to nothing, so a blip in the middle
    // of a long search never adds up to giving up on it.
    expect(nextRead({ failed: false, phase: "searching" })).toBe(POLL_MS)
    expect(nextRead({ failed: true, consecutiveFailures: 1 })).toBe(RETRY_MS)
  })

  it("waits longer after a failure than after a good read", () => {
    expect(RETRY_MS).toBeGreaterThan(POLL_MS)
  })
})

describe("searchIsRunning", () => {
  const PHASES = ["loading", "searching", "answered", "failed"] as const

  it("treats only the two ending phases as finished", () => {
    expect(searchIsRunning("loading")).toBe(true)
    expect(searchIsRunning("searching")).toBe(true)
    expect(searchIsRunning("answered")).toBe(false)
    expect(searchIsRunning("failed")).toBe(false)
  })

  it("counts a search we know nothing about yet as still running", () => {
    // The first poll has not landed. Treating unknown as finished would open
    // the composer during a search that is very much alive.
    expect(searchIsRunning(undefined)).toBe(true)
  })

  /*
   * The invariant this file exists to protect.
   *
   * The page polls while a search runs, and the composer refuses to start a
   * second search while a search runs. Those are the same question, and the
   * moment they are answered by two different pieces of code they can drift:
   * a screen that is still asking for updates while inviting you to throw the
   * search away, or a composer locked open on a search nobody is watching.
   *
   * Mutating searchIsRunning to exclude "loading" fails this; so does
   * reverting nextRead to its own phase comparison and then changing one of
   * them. Both were checked.
   */
  it("never disagrees with the polling clock about whether a search is over", () => {
    for (const phase of PHASES) {
      const stillPolling = nextRead({ failed: false, phase }) !== null
      expect(stillPolling).toBe(searchIsRunning(phase))
    }
  })
})
