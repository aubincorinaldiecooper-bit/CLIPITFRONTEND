import { describe, expect, it } from "vitest"
import { exchangeLines, isEditRequest, reclipNoteText, referencedIndex, sourceWords } from "../components/start/conversation"
import { exchange, match, moments, request } from "./support/moments"

/**
 * The rules of the conversation, apart from any screen: which words are a
 * search and which an edit, which moment a number names, and what a search
 * says once it has answered.
 */
describe("isEditRequest — words about the moment on screen", () => {
  it("reads a search as a search, even one that says \"cut\"", () => {
    expect(isEditRequest("cut every time the crowd cheers")).toBe(false)
    expect(isEditRequest("find when they redo the kitchen")).toBe(false)
    expect(isEditRequest("show me the goal")).toBe(false)
  })

  it("reads words pointed at the clip as an edit", () => {
    expect(isEditRequest("tighten this one")).toBe(true)
    expect(isEditRequest("redo it")).toBe(true)
    expect(isEditRequest("re-cut")).toBe(true)
    expect(isEditRequest("trim the slow intro off this")).toBe(true)
  })

  it("does not spend a re-cut on a search that happens to say \"redo\"", () => {
    expect(isEditRequest("where do they redo the kitchen")).toBe(false)
    // An edit word alone, pointed at nothing, is not an edit either.
    expect(isEditRequest("zoom")).toBe(false)
  })
})

describe("referencedIndex — which moment a number names", () => {
  it("counts the way the stage counts", () => {
    expect(referencedIndex("re-cut video 4")).toBe(3)
    expect(referencedIndex("redo clip #2")).toBe(1)
    expect(referencedIndex("tighten the 3rd one")).toBe(2)
    expect(referencedIndex("re-cut it")).toBeNull()
    expect(referencedIndex("moment 0")).toBeNull()
  })
})

describe("what a search says once it has answered", () => {
  it("says nothing while it is still running", () => {
    expect(exchangeLines(exchange({ status: "searching" }), null, false)).toEqual([])
  })

  it("gives the count it finished with, then the stretch it could not look at, then the maybes", () => {
    const lines = exchangeLines(
      exchange({
        matches: [match()],
        coverage: { complete: false, locatable: true, unsearchedSeconds: 90, gaps: [{ startSeconds: 60, endSeconds: 150, startTimecode: "1:00", endTimecode: "2:30", reason: "provider_refused" }], degraded: [] },
        uncertain: [{ startSeconds: 200, endSeconds: 210, startTimecode: "3:20", endTimecode: "3:30", confidence: 0.4, description: "maybe" }],
      }),
      null,
      false,
    )
    expect(lines).toEqual([
      "Found one moment.",
      "I couldn't look at 1m 30s of this video (1:00–2:30), so I'd have missed anything there.",
      "There's one moment I spotted but wasn't sure about (3:20). Ask me to look again if one sounds right.",
    ])
  })

  it("says where an answer came from in words", () => {
    expect(sourceWords(request({ answeredFrom: "notes" }))).toBe("from what I'd noted")
    expect(sourceWords(request({ answeredFrom: "footage" }))).toBe("from the footage")
    expect(sourceWords(request({ answeredFrom: null, resolvedMode: "both" }))).toBe("watching and listening")
  })
})

describe("what a re-cut note says, from the moment itself", () => {
  it("follows the moment: reworking, failed, done", () => {
    const reworking = moments([exchange({ matches: [match({ reclipStatus: "pending" })] })])
    expect(reclipNoteText(reworking, "match-1", "fallback")).toContain("Re-cutting \"Harbour skyline\"")
    expect(reclipNoteText(reworking, "match-1", "fallback")).toContain("not the change you described")
    const failed = moments([exchange({ matches: [match({ reclipStatus: "failed", reclipError: "GPU cold" })] })])
    expect(reclipNoteText(failed, "match-1", "fallback")).toBe("The re-cut of \"Harbour skyline\" didn't work: GPU cold")
    const done = moments([exchange()])
    expect(reclipNoteText(done, "match-1", "fallback")).toContain("same moment, new cut")
    expect(reclipNoteText(done, "gone", "fallback")).toBe("fallback")
  })
})
