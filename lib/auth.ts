import { betterAuth } from "better-auth"
import { magicLink } from "better-auth/plugins"
import { Pool } from "pg"

/**
 * Sign-in, server side.
 *
 * Passwordless on purpose: a sign-in link by email means no passwords to
 * store, leak, or reset. Better Auth keeps its own four tables (user, session,
 * account, verification — created by scripts/auth-migrate.mjs at boot) in the
 * Postgres named by DATABASE_URL, and holds the signed-in state in an httpOnly
 * cookie on this origin. The backend API never sees any of it; it learns who
 * someone is through the exchange in app/api/backend-session.
 *
 * Built lazily so `next build` succeeds on a machine with no env configured —
 * the route files import this module at build time.
 */

let instance: ReturnType<typeof buildAuth> | null = null

/**
 * True when every env var sign-in needs is present — including the Resend
 * key that actually sends the links. Without it the whole flow is a form
 * that can only fail, so the sign-in control must not render at all.
 */
export function authConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.BETTER_AUTH_SECRET &&
      process.env.BETTER_AUTH_URL &&
      process.env.RESEND_API_KEY,
  )
}

function buildAuth() {
  return betterAuth({
    database: new Pool({ connectionString: process.env.DATABASE_URL }),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    plugins: [
      magicLink({
        // A quarter of an hour: long enough to switch to an email tab, short
        // enough that a forwarded or leaked link goes stale fast.
        expiresIn: 60 * 15,
        sendMagicLink: async ({ email, url }) => {
          await sendSignInEmail(email, url)
        },
      }),
    ],
  })
}

export function getAuth() {
  instance ??= buildAuth()
  return instance
}

/**
 * The sign-in email, through Resend.
 *
 * Until a domain is verified in Resend, mail can only go out from their
 * onboarding@resend.dev address, and ONLY to the address the Resend account
 * is registered under. Anyone else's address is refused by Resend with a 403
 * — which surfaces to the person as "couldn't send", the truthful outcome.
 * Verifying a domain lifts both limits with no code change: set RESEND_FROM.
 */
async function sendSignInEmail(email: string, url: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error("RESEND_API_KEY is not set, so sign-in links cannot be sent")

  const from = process.env.RESEND_FROM ?? "CLIPIT <onboarding@resend.dev>"
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your CLIPIT sign-in link",
      text: `Click to sign in to CLIPIT:\n\n${url}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
      html: [
        `<p>Click to sign in to CLIPIT:</p>`,
        `<p><a href="${url}">Sign in to CLIPIT</a></p>`,
        `<p style="color:#666;font-size:13px">The link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`,
      ].join("\n"),
    }),
  })

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300)
    throw new Error(`Resend refused the email (${response.status}): ${detail}`)
  }
}
