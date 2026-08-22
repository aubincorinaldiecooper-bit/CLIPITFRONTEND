import { headers } from "next/headers"
import { authConfigured, getAuth } from "@/lib/auth"

/**
 * Turns "signed in on this site" into a token the backend API accepts.
 *
 * The proof of sign-in is an httpOnly cookie on THIS origin; the browser will
 * never send it to the API, which lives elsewhere. So this route — running on
 * the server, where the cookie is readable — verifies it and asks the API to
 * mint a bearer token bound to the person, using a shared secret the browser
 * never sees. The client stores that bearer exactly as it stores a guest one.
 *
 * Not signed in is an ordinary answer here, not an error worth logging: the
 * client calls this on every fresh page to ask "am I anyone?", and for guests
 * the answer is simply no.
 */
export async function POST() {
  const secret = process.env.AUTH_BRIDGE_SECRET
  const api = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "")
  if (!secret || !api || !authConfigured()) {
    return Response.json({ error: "Sign-in is not configured" }, { status: 503 })
  }

  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session) {
    return Response.json({ error: "Not signed in" }, { status: 401 })
  }

  const exchange = await fetch(`${api}/api/sessions/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-bridge-secret": secret },
    body: JSON.stringify({ userId: session.user.id, email: session.user.email }),
  })

  if (!exchange.ok) {
    return Response.json({ error: "The API would not issue a session" }, { status: 502 })
  }

  const body = (await exchange.json()) as { token: string }
  return Response.json({ token: body.token, email: session.user.email })
}
