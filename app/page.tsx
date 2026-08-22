import { LandingPage } from "@/components/landing"
import { authConfigured } from "@/lib/auth"

/**
 * The landing's only server-side job: decide whether sign-in exists on this
 * deployment, so the page's first paint already knows. Same test as
 * /api/auth-configured — sign-in needs both the auth env and the bridge
 * secret that lets the API recognise signed-in people.
 *
 * force-dynamic: the answer must come from the running server's env, not
 * from whatever the build machine had.
 */
export const dynamic = "force-dynamic"

export default function Page() {
  const signInAvailable = authConfigured() && Boolean(process.env.AUTH_BRIDGE_SECRET)
  return <LandingPage signInAvailable={signInAvailable} />
}
