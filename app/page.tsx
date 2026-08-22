"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { authClient } from "@/lib/auth-client"

const EASE = [0.2, 0.03, 0.26, 0.99] as const

/**
 * The front door, after the reference: an oversized two-tone headline on the
 * left, a tilted stack of cards drifting off the right edge, two pill
 * buttons, and the product itself below the fold with a one-line caption.
 *
 * The reference's cards are photographs; ours are the product's own clip
 * cards — a still, an amber timecode, a one-line description — because what
 * CLIPIT makes IS the picture. And still no invented numbers anywhere: no
 * backers we don't have, no creator counts, no fabricated views.
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

  useEffect(() => {
    if (session?.user) router.replace("/home")
  }, [session, router])

  return (
    <main className="min-h-dvh w-full overflow-x-clip">
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
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-10 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:pb-6 lg:pt-0">
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
              <Link
                href="/start#signin"
                className="whitespace-nowrap rounded-full px-6 py-3 text-sm text-foreground/75 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-foreground"
              >
                Sign in
              </Link>
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

      {/* Below the fold: caption, then the product itself — the reference's
          screenshot slot, filled with a depiction of our actual screen. */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-16">
        {/* The glyph flows with the words so a wrapped line keeps them
            together instead of leaving the icon stranded at the edge. */}
        <p className="mb-4 text-center text-[13.5px] font-medium text-foreground/70">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="mr-1.5 inline -translate-y-px">
            <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
          </svg>
          Ask in plain words — CLIPIT answers with timecodes
        </p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
          aria-hidden
          className="select-none"
        >
          <div className="rounded-2xl bg-black/45 p-3 shadow-[0_0_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
              <span className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-2.5 py-1.5 text-[11px] text-white/70">
                <span className="size-3 animate-spin rounded-full border-2 border-white/20 border-t-white/70" aria-hidden />
                Watching — 8 minutes in
              </span>
              <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/25">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="translate-x-0.5 text-white" aria-hidden>
                  <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
                </svg>
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2.5 px-1 pb-1">
              <div className="flex justify-end">
                <span className="rounded-2xl bg-white/10 px-3 py-1.5 text-[13px]">
                  clip every time the crowd rushes the stage
                </span>
              </div>
              <p className="text-[13px] text-foreground/80">Found 3 moments. Click one to jump there, or cut it into a clip.</p>
              <div className="rounded-xl bg-black/35 p-2.5 ring-1 ring-white/10">
                <p className="font-mono text-[11.5px] tabular-nums text-amber-300/90">00:04:12 – 00:04:31</p>
                <p className="mt-1 text-[13px] text-foreground/85">Crowd breaks past the barrier toward the stage</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="flex items-center gap-1" aria-hidden>
                    <span className="h-2.5 w-1 rounded-sm bg-emerald-400/90" />
                    <span className="h-2.5 w-1 rounded-sm bg-emerald-400/90" />
                    <span className="h-2.5 w-1 rounded-sm bg-emerald-400/90" />
                    <span className="ml-1.5 text-[11.5px] text-foreground/50">High confidence</span>
                  </span>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-[11.5px] font-medium text-black">Cut this clip</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <ul className="mt-10 grid gap-4 text-[13.5px] text-foreground/55 sm:grid-cols-3">
          <li className="flex items-start gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
            Watches your video once, then answers every question in seconds.
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
            Tells you what it couldn't see — never passes off a blind spot as an empty video.
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
            Every clip downloads as a post-ready MP4, straight from your library.
          </li>
        </ul>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/10 px-6 py-6">
        <p className="text-[13px] text-foreground/40">Upload → ask in plain words → download post-ready clips.</p>
        <Link
          href="/start"
          className="whitespace-nowrap rounded-full bg-white px-5 py-2 text-[13px] font-medium text-black transition-transform active:scale-[0.97] hover:bg-white/90"
        >
          Start clipping
        </Link>
      </footer>
    </main>
  )
}
