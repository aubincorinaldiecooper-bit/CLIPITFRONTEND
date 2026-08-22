"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { authClient } from "@/lib/auth-client"

const EASE = [0.2, 0.03, 0.26, 0.99] as const

/**
 * The front door.
 *
 * A visitor sees the product doing its one thing — a question in plain words,
 * an answer with timecodes — because a depiction of the actual screen sells
 * this better than abstractions. Someone already signed in is sent to their
 * home instead; the pitch is for people who have not seen it yet.
 *
 * Deliberately no invented numbers anywhere: no "10k creators", no fabricated
 * view counts. The product's honesty is the pitch.
 */
export default function LandingPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  useEffect(() => {
    if (session?.user) router.replace("/home")
  }, [session, router])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <span className="font-serif text-2xl tracking-tight">CLIPIT</span>
        <Link
          href="/start"
          className="whitespace-nowrap rounded-full px-4 py-2 text-[13px] text-foreground/70 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-foreground"
        >
          Open the app
        </Link>
      </header>

      <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h1 className="text-balance font-serif text-4xl leading-tight sm:text-5xl">
            Describe the moment.
            <br />
            Get the clip.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-foreground/60">
            Drop in a long video and ask for moments the way you'd ask a person — "every time the
            crowd rushes the stage". CLIPIT watches it once, answers in seconds, and cuts each moment
            into a post-ready MP4.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/start"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-transform active:scale-[0.97] hover:bg-white/90"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
              Start clipping
            </Link>
            <span className="text-[13px] text-foreground/40">No account needed to try it.</span>
          </div>

          <ul className="mt-10 flex flex-col gap-2.5 text-[13.5px] text-foreground/55">
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
              Watches your video once, then answers every question in seconds.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
              Tells you what it couldn't see — it never passes off a blind spot as an empty video.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
              Every clip downloads as a post-ready MP4, straight from your library.
            </li>
          </ul>
        </motion.div>

        {/* A depiction of the actual screen: the stage, a question as you'd
            type it, and the answer as it comes back. Illustrative content,
            clearly of the product's own UI — not data pretending to be real. */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
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
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-6">
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
