import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/client/plugins"

/** The browser's side of sign-in: request a link, read who is signed in, sign out. */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
})
