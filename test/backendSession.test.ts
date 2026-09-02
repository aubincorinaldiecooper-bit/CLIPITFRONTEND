// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The bridge turns "signed in on this site" into a token the API accepts,
 * and carries the guest's claims on their work across: the guest token the
 * same tab still holds, and the hand-over the sign-in link brought for the
 * tab that holds nothing.
 */

const getSession = vi.fn()
const fetchMock = vi.fn()

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("../lib/auth", () => ({
  authConfigured: () => true,
  getAuth: () => ({ api: { getSession: (...args: unknown[]) => getSession(...args) } }),
}))

const { POST } = await import("../app/api/backend-session/route")

function post(body: unknown): Request {
  return new Request("http://site.test/api/backend-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  })
}

function exchangeBody(): Record<string, unknown> {
  const init = fetchMock.mock.calls[0]?.[1] as { body: string }
  return JSON.parse(init.body) as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AUTH_BRIDGE_SECRET = "bridge-secret"
  process.env.NEXT_PUBLIC_API_URL = "http://api.test/"
  vi.stubGlobal("fetch", fetchMock)
  getSession.mockResolvedValue({ user: { id: "user-1", email: "a@b.c" } })
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ token: "user-token" }) })
})

describe("POST /api/backend-session", () => {
  it("carries both claims to the exchange, trimmed, under the bridge secret", async () => {
    const response = await POST(post({ guestToken: " guest-token ", handoff: " hand-over " }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ token: "user-token", email: "a@b.c" })
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(url).toBe("http://api.test/api/sessions/exchange")
    expect(init.headers["x-auth-bridge-secret"]).toBe("bridge-secret")
    expect(exchangeBody()).toEqual({ userId: "user-1", email: "a@b.c", guestToken: "guest-token", handoff: "hand-over" })
  })

  it("carries the hand-over alone — the link opened where no guest token exists", async () => {
    await POST(post({ handoff: "hand-over" }))
    expect(exchangeBody()).toEqual({ userId: "user-1", email: "a@b.c", handoff: "hand-over" })
  })

  it("drops a claim that is not a non-empty string", async () => {
    await POST(post({ guestToken: "   ", handoff: 42 }))
    expect(exchangeBody()).toEqual({ userId: "user-1", email: "a@b.c" })
  })

  it("signs in with nothing to carry when there is no body at all", async () => {
    await POST(post(undefined))
    expect(exchangeBody()).toEqual({ userId: "user-1", email: "a@b.c" })
  })

  it("answers 401 for nobody signed in, without asking the API", async () => {
    getSession.mockResolvedValueOnce(null)
    const response = await POST(post({ handoff: "hand-over" }))
    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
