import { describe, expect, it } from "vitest"
import { nextRead, POLL_MS, RETRY_MS } from "../components/start/search-polling"

describe("when to read a running search again", () => {
  it("keeps reading while it is still working", () => {
    expect(nextRead({ failed: false, phase: "loading" })).toBe(POLL_MS)
    expect(nextRead({ failed: false, phase: "searching" })).toBe(POLL_MS)
  })

  it("stops once the search has answered", () => {
    expect(nextRead({ failed: false, phase: "answered" })).toBeNull()
  })

  it("reads again after a read that failed, rather than giving up", () => {
    // The scouts carry on whether or not one request got through. Stopping
    // here would freeze the screen at whatever it last saw and lose every
    // moment found after it.
    expect(nextRead({ failed: true })).toBe(RETRY_MS)
    expect(nextRead({ failed: true, phase: "answered" })).toBe(RETRY_MS)
  })

  it("waits longer after a failure than after a good read", () => {
    expect(RETRY_MS).toBeGreaterThan(POLL_MS)
  })
})
