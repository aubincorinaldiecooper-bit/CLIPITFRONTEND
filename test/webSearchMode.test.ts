import { afterEach, describe, expect, it } from "vitest"
import { askTarget, shouldRemindForMissingVideo, WEB_SEARCH_PARAM } from "../components/start/ask-gate"
import { writeSearchParams } from "../lib/search-params"

afterEach(() => {
  window.history.replaceState({}, "", "/")
})

describe("explicit web search mode", () => {
  it("routes an empty composer to footage when Web search is off", () => {
    writeSearchParams({ [WEB_SEARCH_PARAM]: "0" }, "replace")
    expect(askTarget(null)).toBe("video")
    expect(shouldRemindForMissingVideo(null, { internetEnabled: false })).toBe(true)
  })

  it("routes an empty composer to the internet only when Web search is on", () => {
    writeSearchParams({ [WEB_SEARCH_PARAM]: "1" }, "replace")
    expect(askTarget(null)).toBe("internet")
    expect(shouldRemindForMissingVideo(null, { internetEnabled: true })).toBe(false)
  })

  it("never lets web mode override a video that is attached or still attaching", () => {
    expect(askTarget({ id: "v1" } as never, { internetEnabled: true })).toBe("video")
    expect(askTarget(null, { attaching: true, internetEnabled: true })).toBe("video")
  })
})
