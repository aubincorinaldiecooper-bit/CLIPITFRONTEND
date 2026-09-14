import { describe, expect, it } from "vitest"
import { asClock, evidenceWords, feedCursor, feedMoments, formatRange, mediaIdentity, previewFor, videoLabel } from "../components/start/moments"
import { exchange, match, video } from "./support/moments"
import type { Video } from "../lib/types"

/**
 * What a moment IS, held apart from any screen: the rules the feed kept
 * (2026-09-02) and the results stage and moment page now share.
 */

const verticalMedia = (derivativeStatus: "pending" | "ready" | "failed") => ({
  composition: { aspectRatio: "9:16", mode: "smart_crop", focalX: 0.5, focalY: 0.5, focusPct: 50, crop: null },
  url: derivativeStatus === "ready" ? "https://cdn.test/clips/v/c-a-vertical.mp4?sig=1" : null,
  canonicalUrl: "https://cdn.test/clips/v/c-a.mp4?sig=1",
  posterUrl: "https://cdn.test/posters/c-a.jpg",
  posterTimestampSeconds: 1,
  sourceAspectRatio: "16:9",
  outputAspectRatio: "9:16",
  compositionMode: "smart_crop",
  derivativeStatus,
})

describe("the moment assumes vertical before the server has said anything", () => {
  it("is 9:16 for a moment with no clip and no platform word in the question", () => {
    // Every clip is vertical. Never landscape. Ever. (Owner, 2026-09-03.)
    // The stage is a fixed 9:16 box, so a 16:9 guess would draw a narrow
    // band floating in black while nothing had failed.
    const preview = previewFor(match(), [], video, null)
    expect(preview?.composition.aspectRatio).toBe("9:16")
    expect(preview?.finished).toBe(false)
    expect(preview?.url).toBe("https://cdn.test/proxy.mp4?sig=1")
    expect(preview?.start).toBe(10)
    expect(preview?.end).toBe(34)
  })

  it("still prefers what the server actually decided, when it has", () => {
    const clips = [{ id: "c-a", clipMatchId: "match-1", status: "ready", url: null, media: verticalMedia("ready") } as never]
    const preview = previewFor(match({ clip: { id: "c-a", status: "ready" } }), clips, video, null)
    expect(preview?.finished).toBe(true)
    expect(preview?.url).toBe("https://cdn.test/clips/v/c-a-vertical.mp4?sig=1")
    expect(preview?.composition.mode).toBe("smart_crop")
  })

  it("never plays the landscape cut in a vertical moment's place while its 9:16 file is still on its way", () => {
    const clips = [{ id: "c-a", clipMatchId: "match-1", status: "ready", url: "https://cdn.test/clips/v/c-a.mp4?sig=1", media: verticalMedia("pending") } as never]
    const preview = previewFor(match({ clip: { id: "c-a", status: "ready" } }), clips, video, null)
    expect(preview?.finished).toBe(false)
    expect(preview?.url).toBe("https://cdn.test/proxy.mp4?sig=1")
  })
})

describe("feedMoments — every moment of every question, in order", () => {
  it("walks the questions in the order asked and the moments strongest first inside each", () => {
    const list = feedMoments(
      [
        exchange({ id: "r1", matches: [match({ id: "a", confidence: 0.5 }), match({ id: "b", confidence: 0.9 })] }),
        exchange({ id: "r2", matches: [match({ id: "c", confidence: 0.7 })] }),
      ],
      video,
    )
    expect(list.map((moment) => moment.match.id)).toEqual(["b", "a", "c"])
    expect(list.map((moment) => moment.requestId)).toEqual(["r1", "r1", "r2"])
  })

  it("keeps decided moments in the list and points at the first undecided one", () => {
    const list = feedMoments([exchange({ matches: [match({ id: "a", feedback: "approved" }), match({ id: "b" })] })], video)
    expect(list.map((moment) => moment.decision)).toEqual(["kept", null])
    expect(feedCursor(list)).toBe(1)
  })

  it("points past the end once every moment is decided", () => {
    const list = feedMoments([exchange({ matches: [match({ id: "a", feedback: "rejected" })] })], video)
    expect(feedCursor(list)).toBe(1)
  })

  it("offers the file to save only once the 9:16 file exists", () => {
    const pending = feedMoments(
      [exchange({ matches: [match({ id: "a", clip: { id: "c-a", status: "ready" } })] }, [{ id: "c-a", clipMatchId: "a", status: "ready", url: "https://cdn.test/x.mp4", media: { ...verticalMedia("pending"), downloadUrl: null } } as never])],
      video,
    )
    expect(pending[0]?.production).toBe("producing")
    expect(pending[0]?.downloadUrl).toBeNull()
    const ready = feedMoments(
      [exchange({ matches: [match({ id: "a", clip: { id: "c-a", status: "ready" } })] }, [{ id: "c-a", clipMatchId: "a", status: "ready", url: "https://cdn.test/x.mp4", media: { ...verticalMedia("ready"), downloadUrl: "https://cdn.test/save.mp4" } } as never])],
      video,
    )
    expect(ready[0]?.production).toBe("produced")
    expect(ready[0]?.downloadUrl).toBe("https://cdn.test/save.mp4")
  })
})

describe("words and clocks", () => {
  it("keys a file by its path, so a re-signed link is the same file and a re-cut is a new one", () => {
    expect(mediaIdentity("https://cdn.test/clips/a.mp4?sig=1")).toBe(mediaIdentity("https://cdn.test/clips/a.mp4?sig=2"))
    expect(mediaIdentity("https://cdn.test/clips/a.mp4?sig=1")).not.toBe(mediaIdentity("https://cdn.test/clips/a-v2.mp4?sig=1"))
  })

  it("reads a range and a clock the way a person does", () => {
    expect(asClock(83.9)).toBe("1:23")
    expect(asClock(Number.NaN)).toBe("0:00")
    expect(formatRange({ startSeconds: 42, endSeconds: 53 })).toBe("0:42–0:53")
  })

  it("says where the footage is from without inventing a name", () => {
    expect(videoLabel(video)).toBe("harbour.mp4")
    expect(videoLabel({ ...video, title: null, originalFilename: null } as Video)).toBe("Your video")
    expect(videoLabel({ ...video, sourceType: "youtube", sourceUrl: "https://www.youtube.com/watch?v=1" } as Video)).toBe("youtube.com")
    expect(videoLabel(null)).toBe("Your video")
  })

  it("says what established a moment in words, not in our field names", () => {
    expect(evidenceWords({ source: "visual" })).toBe("seen")
    expect(evidenceWords({ source: "transcript" })).toBe("heard")
    expect(evidenceWords({ source: "multimodal" })).toBe("seen and heard")
  })
})
