import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Walking away from a part-by-part upload. The request that abandons the
 * parts in storage is the only thing that can reach them, and it is often
 * sent as the person leaves — so it outlives the tab, is tried again when
 * nothing definite came back, and is not when something did (Devin's
 * finding on #96).
 */
const fetchMock = vi.fn()
const priorApiUrl = process.env.NEXT_PUBLIC_API_URL
process.env.NEXT_PUBLIC_API_URL = "http://api.test"
const { api, ApiError } = await import("../lib/api")

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })
const refused = (status: number) =>
  new Response(JSON.stringify({ error: { code: "conflict", message: "This video has no reserved upload location" } }), {
    status,
    headers: { "Content-Type": "application/json" },
  })

/** The calls that went to the abort route, in order. */
const aborts = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/abort-multipart")) as Array<[string, RequestInit]>

/** Answers the sign-in check with "nobody", and the abort route with `answers`, in order. */
function network(...answers: Array<Response | Error>) {
  const queue = [...answers]
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).endsWith("/api/backend-session")) return new Response(null, { status: 401 })
    const next = queue.shift()
    if (next instanceof Error) throw next
    return next ?? ok()
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  // A guest token already in hand, and nobody signed in: the client asks
  // the site once whether that has changed and is told no.
  window.sessionStorage.setItem("clipit.session.token", "guest-token")
  window.sessionStorage.setItem("clipit.session.kind", "guest")
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.sessionStorage.clear()
})
afterAll(() => {
  if (priorApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
  else process.env.NEXT_PUBLIC_API_URL = priorApiUrl
})

describe("api.abortMultipartUpload — walking away from the parts", () => {
  it("is sent so that it outlives the tab, and resolves once storage has taken it", async () => {
    network(ok())
    await api.abortMultipartUpload("v1", "u1")
    expect(aborts()).toHaveLength(1)
    const [url, init] = aborts()[0]!
    expect(url).toBe("http://api.test/api/videos/v1/abort-multipart")
    expect(init.method).toBe("POST")
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(String(init.body))).toEqual({ uploadId: "u1" })
  })

  it("tries again when the network said nothing, and resolves once it then succeeds", async () => {
    network(new TypeError("Failed to fetch"), ok())
    await api.abortMultipartUpload("v1", "u1")
    expect(aborts()).toHaveLength(2)
  })

  it("does not try again after a refusal, and says what was refused", async () => {
    network(refused(409))
    const outcome = await api.abortMultipartUpload("v1", "u1").catch((cause: unknown) => cause)
    expect(outcome).toBeInstanceOf(ApiError)
    expect((outcome as InstanceType<typeof ApiError>).status).toBe(409)
    expect(aborts()).toHaveLength(1)
  })

  it("gives up after three attempts, and rejects rather than pretending", async () => {
    network(new TypeError("Failed to fetch"), new TypeError("Failed to fetch"), new TypeError("Failed to fetch"))
    await expect(api.abortMultipartUpload("v1", "u1")).rejects.toBeInstanceOf(TypeError)
    expect(aborts()).toHaveLength(3)
  })
})
