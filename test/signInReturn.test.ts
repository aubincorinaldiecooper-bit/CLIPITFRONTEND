import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The magic link opens wherever the email is read, and the guest token that
 * names the work stays behind in the tab that made it. The return address
 * carries the guest's claim instead — and never breaks the sign-in when
 * there is no claim to carry.
 */

const requestHandoff = vi.fn()

vi.mock("../lib/api", () => ({
  HANDOFF_PARAM: "handoff",
  api: { requestHandoff: (...args: unknown[]) => requestHandoff(...args) },
}))

const { returnAddress } = await import("../lib/sign-in-return")

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, "", "/start?videos=v1&then=publish%3Ac1")
})

describe("returnAddress", () => {
  it("carries the guest's hand-over, keeping the video and errand already parked on the address", async () => {
    requestHandoff.mockResolvedValueOnce("tok_abc-_1")
    expect(await returnAddress("a@b.c")).toBe("/start?videos=v1&then=publish%3Ac1&handoff=tok_abc-_1")
    // Asked for with the address the link goes to: the claim answers that sign-in only.
    expect(requestHandoff).toHaveBeenCalledWith("a@b.c")
  })

  it("is the plain address when there is nothing to hand over — signed in already, or the API unreachable", async () => {
    requestHandoff.mockResolvedValueOnce(null)
    expect(await returnAddress("a@b.c")).toBe("/start?videos=v1&then=publish%3Ac1")
  })

  it("takes a base address, for the header's sign-in", async () => {
    requestHandoff.mockResolvedValueOnce("h")
    expect(await returnAddress("a@b.c", "/publishing")).toBe("/publishing?handoff=h")
  })

  it("never carries a stale hand-over twice", async () => {
    window.history.replaceState(null, "", "/start?handoff=old")
    requestHandoff.mockResolvedValueOnce("new")
    expect(await returnAddress("a@b.c")).toBe("/start?handoff=new")
  })
})
