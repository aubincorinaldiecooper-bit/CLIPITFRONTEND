# CLIPIT — frontend

The app for CLIPIT: drop in a long video, describe the moment you want in
plain language, get the clip back. The backend lives in
[`aubincorinaldiecooper-bit/CLIPIT`](https://github.com/aubincorinaldiecooper-bit/CLIPIT).

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Motion · Better Auth

```bash
npm install
npm run dev      # http://localhost:3000 — also creates the auth tables if DATABASE_URL is set
npm run build
```

## The screens

- **`/`** — the public pitch: a depiction of the product's own screen (a
  question, an answer with timecodes, a cut button) beside the headline and one
  Start clipping call to action. Signed-in visitors are sent to `/home`.
- **`/home`** — the signed-in home: your own numbers (videos, minutes,
  questions answered, clips cut — counted from your rows, never estimated),
  your newest clips playable in place, and the post-performance panel that
  says plainly it fills once a social account is connected.
- **`/start`** — the search screens, three addresses on one page: home
  (`/start`) is one statement and one composer — attach a video, ask for a
  moment in plain words; the results (`/start?video=…&search=…`) say what
  the search said and put the moments on a coverflow with one in the centre
  playing; a moment (`…&moment=…`) is the player and the conversation about
  it, where a question is a new search and "re-cut it" reworks the moment.
  Back walks the three, and a reload lands where it left off.
- **`/clips`** — the library: every finished clip, playable in place,
  downloadable as a post-ready MP4, paged all the way back.
- **`/publishing`** — where social account connections will live; clips
  download today and will post from here later.

The search screens wear a light header — the mark, Library, Shared, New
search and the account — and nothing else. The library and the shared rooms
keep the collapsible side rail (224px open, 52px closed, remembered per
browser) on desktop, with a link row in the header on phones.

## Sign-in

Passwordless, by email link, via Better Auth + Resend — see `lib/auth.ts`.
Env it needs: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`AUTH_BRIDGE_SECRET` (shared with the API), `RESEND_API_KEY`, and optionally
`RESEND_FROM`. Without them the app runs guest-only and the sign-in control
never renders. Until a domain is verified in Resend, links can only be
delivered to the address the Resend account is registered under.

The API is addressed by `NEXT_PUBLIC_API_URL`. The browser holds a bearer
token in sessionStorage — guest sessions end with the tab; signed-in identity
survives through Better Auth's cookie and is re-exchanged on the next visit.
