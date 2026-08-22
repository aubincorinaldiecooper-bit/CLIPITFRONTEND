import { authConfigured, getAuth } from "@/lib/auth"

/**
 * Better Auth's own endpoints — sending the magic link, verifying it, reading
 * and ending the signed-in session. Handlers resolve the auth instance per
 * request so `next build` never needs the env configured.
 */
const notConfigured = () =>
  Response.json({ error: "Sign-in is not configured on this deployment" }, { status: 503 })

export async function GET(request: Request) {
  if (!authConfigured()) return notConfigured()
  return getAuth().handler(request)
}

export async function POST(request: Request) {
  if (!authConfigured()) return notConfigured()
  return getAuth().handler(request)
}
