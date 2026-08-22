"use client"

import Link from "next/link"
import { AppShell } from "@/components/app-shell"

/**
 * Where publishing will live.
 *
 * Deliberately a page and not a hidden roadmap item: connecting social
 * accounts is part of what this product is becoming, and the place for it
 * should exist before the plumbing does. Equally deliberately, there are no
 * disabled platform buttons here — a button that cannot work is an
 * advertisement for a broken action, and the honest state is a sentence.
 */
export default function PublishingPage() {
  return (
    <AppShell active="publishing">
      <div className="mx-auto w-full max-w-2xl flex-1 py-8">
        <h1 className="font-serif text-3xl">Publishing</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground/60">
          This is where you'll connect the accounts you post to — TikTok, YouTube, Instagram — and send
          clips straight from your library.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground/60">
          None of those connections exist yet. Until they do, every clip in your library downloads as a
          ready-to-post MP4.
        </p>
        <Link
          href="/clips"
          className="mt-6 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition-transform active:scale-[0.97] hover:bg-white/90"
        >
          Go to your clips
        </Link>
      </div>
    </AppShell>
  )
}
