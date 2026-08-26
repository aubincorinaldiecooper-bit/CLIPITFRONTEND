import { readFileSync } from "node:fs"
import path from "node:path"
import { type NextRequest, NextResponse } from "next/server"

/**
 * The front door is the owner's landing page, served as the document they
 * wrote.
 *
 * The page arrived as a complete, self-contained HTML file — its own styles,
 * its own script, its own fonts — and it is served verbatim rather than
 * rebuilt in React. Rebuilding 1,300 lines of finished design in another
 * idiom is how detail gets lost, and this session already proved that the
 * hard way. A route handler returns the document itself; a page component
 * cannot, because Next would nest one <html> inside another.
 *
 * One edit was made to the stored file, and only one: its three "Try free"
 * links pointed at a placeholder signup domain, and they now point at /start
 * — clipping is open to guests, so that is the product's real front door.
 * The og/canonical placeholder URLs are left exactly as written; the file's
 * own TODO says to fill in the real domain, and that domain is the owner's
 * to name, not ours to invent.
 */

/** Read once per process, not once per request. */
let cached: string | null = null

function landingHtml(): string {
  if (cached === null) {
    cached = readFileSync(path.join(process.cwd(), "content", "landing-v57.html"), "utf8")
  }
  return cached
}

export function GET(request: NextRequest) {
  // Someone already signed in has no business on the marketing page — carry
  // them straight to Home, as the old landing did. Presence of the session
  // cookie is enough of a signal here: this is a courtesy redirect, and /home
  // verifies the session properly. Better Auth's cookie is
  // better-auth.session_token, carrying a __Secure- prefix on HTTPS, so match
  // on the stable part of the name.
  const signedIn = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("session_token") && cookie.value !== "")
  if (signedIn) {
    return NextResponse.redirect(new URL("/home", request.url))
  }

  return new NextResponse(landingHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // The marketing page can be cached briefly; it changes by deploy.
      "Cache-Control": "public, max-age=300",
    },
  })
}
