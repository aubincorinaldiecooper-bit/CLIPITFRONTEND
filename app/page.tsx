"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { authClient } from "@/lib/auth-client"

const EASE = [0.2, 0.03, 0.26, 0.99] as const

/**
 * The front door, after the reference: a tight two-tone headline on the left,
 * a ribbon of stills sweeping down the right edge, a pill button. One screen,
 * one idea, no scroll.
 *
 * Measured off the reference rather than eyeballed, because the first attempts
 * missed it: its pictures are SMALL — about a sixth of the viewport wide —
 * packed into a narrow band down the right third, overlapping by roughly a
 * third of their height, tilted only a few degrees, and carrying no text at
 * all. They sweep in a gentle S (right, out to the left, back to the right),
 * not a hard zigzag, and the ones at each end are washed out and cropped by
 * the edge of the screen.
 *
 * Theirs are photographs. Ours are video frames — the honest picture of what
 * CLIPIT makes — drawn rather than photographed, because the repository ships
 * no stock imagery and inventing a real-looking photo of a real-looking event
 * is not something a landing page should do. They are built from shapes, not
 * soft gradients, so each one reads as a scene: a sun over water, a lit pitch,
 * a skyline at dusk. No invented numbers anywhere either.
 */

type Scene = {
  /** Sky (or room) behind everything. */
  sky: string
  /** Where the ground/water begins, as a percentage of frame height. */
  horizon?: number
  ground?: string
  /** A sun or lamp: position and size as percentages, plus its colour. */
  sun?: { x: number; y: number; size: number; color: string }
  /** A cone of light falling from the top edge. */
  beam?: string
  /** Building silhouettes along the horizon: [left%, width%, height%]. */
  skyline?: Array<[number, number, number]>
  /** Heads in the foreground, as a crowd would read from behind. */
  crowd?: boolean
  /** A lit sign, as a neon storefront reads at night. */
  sign?: { x: number; y: number; w: number; h: number; color: string }
}

const RIBBON: Array<{
  y: string
  x: string
  rotate: number
  fade: number
  scene: Scene
}> = [
  // Cropped by the top edge and washed out, as the reference's corner photo is.
  {
    y: "-9%", x: "58%", rotate: 5, fade: 0.45,
    scene: {
      sky: "linear-gradient(to bottom, #bfe3ec, #e6f1f2)",
      horizon: 52,
      ground: "linear-gradient(to bottom, #6fb0c2, #2f6a7d)",
      sun: { x: 72, y: 26, size: 16, color: "rgba(255,252,230,.95)" },
    },
  },
  {
    y: "-1%", x: "46%", rotate: 3, fade: 1,
    scene: {
      sky: "linear-gradient(to bottom, #6fb2dd, #bfdcee)",
      horizon: 46,
      ground: "linear-gradient(to bottom, #e0d770 0%, #b9bd50 45%, #7c8c3a 100%)",
    },
  },
  {
    y: "11.5%", x: "33%", rotate: -2, fade: 1,
    scene: {
      sky: "linear-gradient(to bottom, #f9c072 0%, #ec8347 45%, #c25a5c 100%)",
      horizon: 62,
      ground: "linear-gradient(to bottom, #7c3b58, #2f1830)",
      sun: { x: 64, y: 40, size: 22, color: "rgba(255,240,190,.98)" },
    },
  },
  // Night street: the dark frame in the run, kept legible by its own lights.
  {
    y: "24%", x: "20%", rotate: -5, fade: 1,
    scene: {
      sky: "linear-gradient(to bottom, #2b3a52, #141b28)",
      horizon: 70,
      ground: "linear-gradient(to bottom, #1b2433, #0d1219)",
      sign: { x: 52, y: 26, w: 30, h: 15, color: "rgba(255,96,84,.95)" },
      skyline: [[4, 14, 34], [20, 10, 22], [78, 16, 40], [94, 10, 26]],
    },
  },
  {
    y: "36.5%", x: "14%", rotate: -3, fade: 1,
    scene: {
      sky: "linear-gradient(to bottom, #16323c, #0e232b)",
      horizon: 44,
      ground: "linear-gradient(to bottom, #3f8f6a 0%, #276a4d 60%, #17422f 100%)",
      beam: "radial-gradient(50% 62% at 50% 0%, rgba(255,252,225,.75), transparent 70%)",
    },
  },
  {
    y: "49%", x: "25%", rotate: 2, fade: 1,
    scene: {
      sky: "linear-gradient(to bottom, #4f4d9e 0%, #8f6a9c 52%, #e79b6c 100%)",
      horizon: 74,
      ground: "linear-gradient(to bottom, #3b2a3a, #1c1419)",
      skyline: [[2, 12, 40], [16, 8, 26], [26, 14, 52], [42, 9, 32], [54, 16, 46], [72, 11, 30], [86, 13, 42]],
    },
  },
  {
    y: "61.5%", x: "45%", rotate: 5, fade: 1,
    scene: {
      sky: "linear-gradient(to bottom, #4a3120, #23181a)",
      beam: "radial-gradient(42% 78% at 50% 0%, rgba(255,198,98,.9), transparent 66%)",
      crowd: true,
    },
  },
  // Cropped by the bottom edge and washed out, closing the run.
  {
    y: "84%", x: "70%", rotate: 7, fade: 0.35,
    scene: {
      sky: "linear-gradient(to bottom, #7e93a6, #35424e)",
      horizon: 58,
      ground: "linear-gradient(to bottom, #46586a, #1b232c)",
    },
  },
]

/** One drawn frame. Shapes, not blur — a swatch does not read as footage. */
function SceneFrame({ scene }: { scene: Scene }) {
  return (
    <div className="absolute inset-0" style={{ backgroundImage: scene.sky }}>
      {scene.sun && (
        <span
          className="absolute rounded-full"
          style={{
            left: `${scene.sun.x}%`,
            top: `${scene.sun.y}%`,
            width: `${scene.sun.size}%`,
            aspectRatio: "1",
            background: scene.sun.color,
            boxShadow: `0 0 ${scene.sun.size * 2}px ${scene.sun.color}`,
          }}
        />
      )}

      {scene.skyline?.map(([left, width, height], index) => (
        <span
          key={index}
          className="absolute bg-black/55"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            height: `${height}%`,
            bottom: `${100 - (scene.horizon ?? 100)}%`,
          }}
        />
      ))}

      {scene.ground && (
        <span
          className="absolute inset-x-0 bottom-0"
          style={{ top: `${scene.horizon ?? 60}%`, backgroundImage: scene.ground }}
        />
      )}

      {scene.sign && (
        <span
          className="absolute rounded-[2px]"
          style={{
            left: `${scene.sign.x}%`,
            top: `${scene.sign.y}%`,
            width: `${scene.sign.w}%`,
            height: `${scene.sign.h}%`,
            background: scene.sign.color,
            boxShadow: `0 0 24px ${scene.sign.color}`,
          }}
        />
      )}

      {scene.beam && <span className="absolute inset-0" style={{ backgroundImage: scene.beam }} />}

      {scene.crowd && (
        <span className="absolute inset-x-0 bottom-0 h-[38%]">
          {[6, 22, 38, 54, 70, 86].map((left, index) => (
            <span
              key={left}
              className="absolute bottom-0 rounded-t-full bg-black/70"
              style={{ left: `${left - 7}%`, width: "15%", height: `${58 + (index % 3) * 16}%` }}
            />
          ))}
        </span>
      )}

      {/* A photograph darkens at its corners; a flat fill does not. */}
      <span className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_45%,transparent_45%,rgba(0,0,0,0.45)_100%)]" />
    </div>
  )
}

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
    <main className="relative flex min-h-dvh w-full flex-col overflow-x-clip">
      {/* The ribbon's stage, anchored to MAIN rather than the centered
          section: the section stops 144px short of the browser edge at
          1440px (further on wider screens), and a ribbon clipped there
          floats mid-air instead of being cropped by the screen. Anchored
          here, overflow-hidden crops the first still at the true top corner
          behind the header and the run at the true right edge — that crop
          is the point, not an oversight. Hidden on phones, where the
          headline is the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[34rem] select-none overflow-hidden lg:block"
      >
        <div className="absolute -right-20 top-0 h-full w-[30rem]">
          {RIBBON.map((still, index) => (
              <motion.div
                key={still.y}
                initial={{ opacity: 0, y: 26, rotate: still.rotate * 1.8 }}
                animate={{ opacity: still.fade, y: 0, rotate: still.rotate }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.12 + index * 0.075 }}
                className="absolute w-[16rem]"
                style={{ left: still.x, top: still.y, zIndex: index + 1 }}
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/15">
                  <SceneFrame scene={still.scene} />
                </div>
              </motion.div>
            ))}
        </div>
      </div>
      {/* z-20: the header stays legible above the ribbon's topmost still,
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

      {/* Hero: copy left, ribbon down the right third. Nothing follows it, so
          on phones — where the ribbon steps aside — the copy takes the leftover
          height and centres in it rather than leaving a screen of dead space. */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-1 items-center px-6 pb-20 pt-6 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-8 lg:pb-0 lg:pt-0">
        <div className="relative z-10 max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            {/* The reference's headline is a heavy sans set very tight, and
                that weight is most of its character — a serif reads as a
                different page entirely. The wordmark stays serif; it's ours. */}
            <h1 className="text-balance font-sans text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[4.25rem]">
              Describe the moment
              <br />
              <span className="text-foreground/40">get the clip</span>
            </h1>
            <p className="mt-7 max-w-lg text-[17px] leading-relaxed text-foreground/55">
              The future of clipping. Ask a long video for moments the way you'd ask a person —
              CLIPIT watches it once, answers in seconds, and cuts post-ready MP4s.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/start"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-7 py-3.5 text-[15px] font-medium text-black transition-transform active:scale-[0.97] hover:bg-white/90"
              >
                Start clipping
              </Link>
              {signInAvailable && (
                <Link
                  href="/start#signin"
                  className="whitespace-nowrap rounded-full px-7 py-3.5 text-[15px] text-foreground/75 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  Sign in
                </Link>
              )}
            </div>
            <p className="mt-4 text-[13px] text-foreground/40">No account needed to try it.</p>
          </motion.div>
        </div>

      </section>
    </main>
  )
}
