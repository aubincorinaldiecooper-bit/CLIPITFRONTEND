import { authConfigured } from "@/lib/auth"

/**
 * Whether sign-in exists on this deployment, for the header to ask.
 *
 * The browser cannot read server env, and a guest-only deployment is a
 * supported configuration — its header must not offer a sign-in that can
 * only fail.
 */
export async function GET() {
  const configured = authConfigured() && Boolean(process.env.AUTH_BRIDGE_SECRET)
  return Response.json({ configured })
}
