"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { useState } from "react"
import { OrbitGallery } from "@/components/orbit-gallery"

const ITEMS = Array.from({ length: 20 }, (_, index) => ({
  src: `/images/demo/shared/${index + 1}.webp`,
  alt: `Orbit gallery image ${index + 1}`,
}))

const EASE = [0.2, 0.03, 0.26, 0.99] as const

export default function Home() {
  const [webGlReady, setWebGlReady] = useState(false)

  return (
    <main className="relative h-screen overflow-hidden bg-background">
      <OrbitGallery
        items={ITEMS}
        onReady={() => setWebGlReady(true)}
        className="fixed inset-0 h-full w-full"
        radius={2.8}
        rings={3}
        ringGap={1.6}
        tileHeight={0.7}
        cornerRadius={0.08}
        spinSpeed={1}
        spinStagger={0.2}
        // The rings turn on their own; the viewer cannot drive them.
        wheel={false}
        wheelMultiplier={3}
        revealDuration={2}
        focusDuration={1}
      />

      {webGlReady && (
        <motion.div
          initial={{ opacity: 0, filter: "blur(3px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: EASE }}
          className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
        >
          {/* Keeps the centre legible as lit tiles pass behind it. */}
          <div
            aria-hidden="true"
            className="absolute size-[46rem] max-w-[130vw] [background:radial-gradient(closest-side,rgba(8,8,10,0.94),rgba(8,8,10,0.8)_42%,rgba(8,8,10,0)_72%)]"
          />

          <div className="relative flex flex-col items-center">
            <span className="font-serif text-4xl tracking-tight sm:text-5xl">CLIPIT</span>

            <p className="mt-3 max-w-sm text-balance text-sm text-foreground/65 sm:text-base">
              Drop in a long video. Describe the moment. Get the clip.
            </p>

            <Link
              href="/start"
              className="pointer-events-auto mt-8 rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground active:scale-[0.99]"
            >
              Start clipping
            </Link>

            <span className="mt-4 text-xs text-foreground/40">
              Upload a file or paste a YouTube link
            </span>
          </div>
        </motion.div>
      )}
    </main>
  )
}
