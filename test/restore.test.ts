import { describe, expect, it, vi } from "vitest"
import { consumeSearchParams, hasReviewable, matchForClip, restoreConversation } from "../components/start/restore"
import type { Exchange } from "../components/start/types"
import type { ClipRequest } from "../lib/types"

/**
 * Reopening a video brings its conversation back from the server — after a
 * sign-in that returned here, a reload, a video opened from history.
 */

const request = (overrides: Partial<ClipRequest>): ClipRequest =>
  ({ id: "r1", status: "completed", matches: [], ...overrides }) as unknown as ClipRequest

describe("restoreConversation", () => {
  it("brings back every question with its answer's clips, in the server's order, through the page's reconciler", async () => {
    const listClipRequests = vi.fn(async () => ({ clipRequests: [request({ id: "r1" }), request({ id: "r2", status: "searching" })] }))
    const getClipRequest = vi.fn(async (id: string) => ({ clipRequest: request({ id, instruction: `q-${id}` } as Partial<ClipRequest>), clips: [{ id: `clip-${id}` }] as never }))
    const reconcile = vi.fn((r: ClipRequest) => ({ ...r, reconciled: true }) as ClipRequest)
    const exchanges = await restoreConversation("vid-1", { listClipRequests, getClipRequest }, reconcile)
    expect(listClipRequests).toHaveBeenCalledWith("vid-1")
    expect(exchanges.map((e) => e.request.id)).toEqual(["r1", "r2"])
    expect(exchanges[0]!.clips).toEqual([{ id: "clip-r1" }])
    expect((exchanges[0]!.request as unknown as { reconciled: boolean }).reconciled).toBe(true)
  })
})

describe("consumeSearchParams", () => {
  it("takes only the named parameters out of the address, and leaves the rest", () => {
    window.history.replaceState(null, "", "/start?videos=vid-1&then=publish:c-1&other=1")
    consumeSearchParams(["videos"])
    expect(window.location.search).toBe("?then=publish%3Ac-1&other=1")
    consumeSearchParams(["then"])
    expect(window.location.search).toBe("?other=1")
    // Nothing named: the address is left alone.
    consumeSearchParams(["videos"])
    expect(window.location.search).toBe("?other=1")
  })
})

describe("hasReviewable", () => {
  it("is true only when a completed answer has moments", () => {
    expect(hasReviewable([])).toBe(false)
    expect(hasReviewable([{ request: request({ status: "searching", matches: [{ id: "m1" } as never] }), clips: [] }])).toBe(false)
    expect(hasReviewable([{ request: request({ matches: [] }), clips: [] }])).toBe(false)
    expect(hasReviewable([{ request: request({ matches: [{ id: "m1" } as never] }), clips: [] }])).toBe(true)
  })
})

describe("matchForClip", () => {
  it("finds the moment a clip belongs to, wherever it sits, and nothing for a clip that is not there", () => {
    const exchanges: Exchange[] = [
      { request: request({ id: "r1", matches: [{ id: "m1", clip: { id: "c-1" } }] as never }), clips: [] },
      { request: request({ id: "r2", matches: [{ id: "m2", clip: null }, { id: "m3", clip: { id: "c-3" } }] as never }), clips: [] },
    ]
    expect(matchForClip(exchanges, "c-3")).toEqual({ requestId: "r2", matchId: "m3" })
    expect(matchForClip(exchanges, "c-1")).toEqual({ requestId: "r1", matchId: "m1" })
    expect(matchForClip(exchanges, "c-9")).toBeNull()
  })
})
