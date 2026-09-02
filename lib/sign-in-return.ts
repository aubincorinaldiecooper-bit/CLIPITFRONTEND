import { api, HANDOFF_PARAM } from "./api"

/**
 * Where a sign-in link should bring the person back to — with their work.
 *
 * The magic link opens wherever the email is read: a new tab, a phone. The
 * guest token that names the video they just uploaded stays behind in the
 * tab that made it, on purpose (see lib/api.ts). So before the link is
 * sent, a guest asks the API for a hand-over — a single-use claim on that
 * work — and it rides in the return address. Whichever tab the link opens
 * in redeems it as part of signing in, and the video is theirs there.
 *
 * Best-effort by design: no hand-over (signed in already, or the API could
 * not be reached) means the plain address, and the sign-in still works —
 * the same-tab path still carries the token itself.
 */
export async function returnAddress(base?: string): Promise<string> {
  const address = base ?? `${window.location.pathname}${window.location.search}`
  const handoff = await api.requestHandoff()
  if (!handoff) return address
  const url = new URL(address, window.location.origin)
  url.searchParams.set(HANDOFF_PARAM, handoff)
  return `${url.pathname}${url.search}`
}
