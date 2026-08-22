"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { authClient } from "@/lib/auth-client"

const EASE = [0.2, 0.03, 0.26, 0.99] as const

/**
 * The front door, after the reference: an oversized two-tone headline on the
 * left, a waterfall of stills pouring off the right edge, and the buttons.
 * Nothing else — one screen, one idea, no scroll.
 *
 * The reference's pictures are photographs; ours are the product's own clip
 * stills — a frame, an amber timecode, a one-line description — because what
 * CLIPIT makes IS the picture. And no invented numbers anywhere: no backers
 * we don't have, no creator counts, no fabricated views.
 */

/**
 * The waterfall, after the reference: large frameless stills cascading down
 * the right edge in a loose zigzag, each overlapping the one above it, the
 * right-shifted ones cropped by the screen edge. Not cards — pictures, with
 * the timecode and description burned into the image top-left the way a
 * camera stamps its overlay, so a lower still can overlap the bottom of the
 * one above without ever covering its words.
 */
const WATERFALL = [
  // The corner still is a cropped accent, as in the reference — no text,
  // because the header's button crosses it and words under a button are
  // words nobody can read. Its moment is the one featured in the mock below.
  { rotate: 6, x: "62%", y: "-6%", w: "24rem", text: false, hue: "from-zinc-700/80 via-zinc-900 to-zinc-950", timecode: "00:04:12", label: "Crowd rushes the stage" },
  { rotate: -4, x: "4%", y: "15%", w: "26rem", text: true, hue: "from-sky-700/80 via-slate-900 to-slate-950", timecode: "00:11:48", label: "The demo finally works" },
  { rotate: 3, x: "40%", y: "34%", w: "24rem", text: true, hue: "from-amber-600/80 via-orange-950 to-zinc-950", timecode: "00:16:27", label: "Sunset over the pier" },
  { rotate: -3, x: "0%", y: "53%", w: "26rem", text: true, hue: "from-stone-400/70 via-stone-800 to-stone-950", timecode: "00:07:03", label: "Dog steals the microphone" },
  { rotate: 5, x: "36%", y: "76%", w: "24rem", text: true, hue: "from-indigo-600/70 via-indigo-950 to-zinc-950", timecode: "00:02:55", label: "Game-winning three" },
] as const

export default function LandingPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  // Sign in is offered only where it exists. A guest-only deployment (no
  // auth env) renders no sign-in form on /start, so a Sign in button there
  // would be a door painted on a wall. Same check the app header makes.
  const [signInAvailable, setSignInAvailable] = useState(false)

  useEffect(() => {
    if (session?.user) router.replace("/home")
  }, [session, router])

  useEffect(() => {
    let cancelled = false
    void fetch("/api/auth-configured")
      .then((response) => response.json() as Promise<{ configured: boolean }>)
      .then((body) => {
        if (!cancelled && body.configured) setSignInAvailable(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex min-h-dvh w-full flex-col overflow-x-clip">
      {/* z-20: the header stays legible above the waterfall's topmost still,
          which climbs up beside it the way the reference's corner photo does. */}
      <div className="relative z-20 mx-auto flex w-full max-w-6xl flex-col px-6 py-7">
        <header className="flex items-center justify-between gap-4">
          <span className="font-serif text-2xl tracking-tight">CLIPIT</span>
          <Link
            href="/start"
            className="whitespace-nowrap rounded-full bg-black/30 px-4 py-2 text-[13px] text-foreground/70 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/5 hover:text-foreground"
          >
            Open the app
          </Link>
        </header>
      </div>

      {/* Hero: copy left, waterfall bleeding off the right edge. A grid, not
          absolute positioning at the section level, so the waterfall's stage
          contributes real height and can never spill into the section below. */}
      {/* Nothing follows the hero, so on phones — where the waterfall steps
          aside — it takes the leftover height and centres in it rather than
          leaving a screen of dead space beneath the buttons. */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-1 items-center px-6 pb-20 pt-10 lg:grid lg:flex-none lg:grid-cols-2 lg:items-start lg:gap-6 lg:pb-6 lg:pt-0">
        <div className="relative z-10 max-w-xl lg:pt-28">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <h1 className="text-balance font-serif text-5xl leading-[1.06] sm:text-6xl lg:text-7xl">
              Describe the moment
              <br />
              <span className="text-foreground/40">get the clip</span>
            </h1>
            <p className="mt-7 max-w-md text-[15px] leading-relaxed text-foreground/60">
              The future of clipping. Ask a long video for moments the way you'd ask a person —
              CLIPIT watches it once, answers in seconds, and cuts post-ready MP4s.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/start"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-transform active:scale-[0.97] hover:bg-white/90"
              >
                Start clipping
              </Link>
              {signInAvailable && (
                <Link
                  href="/start#signin"
                  className="whitespace-nowrap rounded-full px-6 py-3 text-sm text-foreground/75 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  Sign in
                </Link>
              )}
            </div>
            <p className="mt-4 text-[13px] text-foreground/40">No account needed to try it.</p>
          </motion.div>
        </div>

        {/* The waterfall, on a fixed-height stage that runs off the right
            edge as in the reference and starts up beside the header; hidden
            on phones, where the headline is the hero. Later stills stack on
            top of earlier ones, so each overlap covers the bottom of the
            still above — never its top-left overlay text. */}
        <div aria-hidden className="pointer-events-none relative hidden h-[54rem] select-none lg:block">
          <div className="absolute -right-24 -top-12 h-full w-[40rem]">
          {WATERFALL.map((still, index) => (
            <motion.div
              key={still.timecode}
              initial={{ opacity: 0, y: 32, rotate: still.rotate * 1.6 }}
              animate={{ opacity: 1, y: 0, rotate: still.rotate }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.15 + index * 0.1 }}
              className="absolute"
              style={{ left: still.x, top: still.y, width: still.w, zIndex: index + 1 }}
            >
              <div className={`relative aspect-video w-full overflow-hidden rounded-3xl bg-gradient-to-br shadow-[0_28px_70px_rgba(0,0,0,0.6)] ring-1 ring-white/10 ${still.hue}`}>
                {still.text && (
                  <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 via-black/25 to-transparent p-4 pb-8">
                    <p className="font-mono text-[11.5px] tabular-nums text-amber-300/90">{still.timecode}</p>
                    <p className="mt-0.5 text-[13px] text-white/85">{still.label}</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          </div>
        </div>
      </section>
    </main>
  )
}
