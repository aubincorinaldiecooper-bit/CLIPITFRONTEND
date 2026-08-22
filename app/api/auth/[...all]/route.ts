import { getAuth } from "@/lib/auth"

/**
 * Better Auth's own endpoints — sending the magic link, verifying it, reading
 * and ending the signed-in session. Handlers resolve the auth instance per
 * request so `next build` never needs the env configured.
 */
export async function GET(request: Request) {
  return getAuth().handler(request)
}

export async function POST(request: Request) {
  return getAuth().handler(request)
}
