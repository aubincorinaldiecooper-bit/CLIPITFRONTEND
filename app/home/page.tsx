"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import type { ActivityStats, LibraryClip } from "@/lib/types"
import { AppShell } from "@/components/app-shell"
import { authClient } from "@/lib/auth-client"

/**
 * Home: what you have done here, what you cut most recently, and the one
 * button that matters.
 *
 * Every number on this screen is a count of the caller's own rows. The one
 * section that cannot be real yet — how clips perform once posted — says so
 * in a sentence instead of wearing invented zeros as if they were data.
 */
export default function HomePage() {
  const { data: session } = authClient.useSession()
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [recent, setRecent] = useState<LibraryClip[] | null>(null)
  const [recentFailed, setRecentFailed] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .getStats()
      .then(({ stats: counted }) => {
        if (!cancelled) setStats(counted)
      })
      .catch(() => {
        // A home page without numbers is still a home page.
      })
    void api
      .listClips()
      .then((page) => {
        if (!cancelled) setRecent(page.clips.slice(0, 6))
      })
      .catch(() => {
        // A failed load is not an empty library. "Nothing yet" over an outage
        // tells someone their clips are gone when they are not.
        if (!cancelled) setRecentFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = session?.user?.email?.split("@")[0]

  return (
    <AppShell active="home">
      <div className="mx-auto w-full max-w-6xl flex-1 py-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="font-serif text-3xl">{firstName ? `Welcome back, ${firstName}` : "Welcome"}</h1>
            <p className="mt-2 text-sm text-foreground/55">
              Drop in a long video, describe the moment, and cut it into a post-ready clip.
            </p>
          </div>
          <Link
            href="/start"
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-transform active:scale-[0.97] hover:bg-white/90"
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
        </div>

        {/* Counted from this caller's rows; a dash means "not loaded", never
            a fake zero. */}
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              { label: "Videos", value: stats?.videos },
              { label: "Minutes of video", value: stats?.minutesOfVideo },
              { label: "Questions answered", value: stats?.questionsAnswered },
              { label: "Clips cut", value: stats?.clipsCut },
            ] as const
          ).map((tile) => (
            <div key={tile.label} className="rounded-xl bg-black/35 px-4 py-3.5 ring-1 ring-white/10">
              <p className="text-2xl font-medium tabular-nums">{tile.value ?? "—"}</p>
              <p className="mt-0.5 text-[12.5px] text-foreground/50">{tile.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-medium text-foreground/80">Recent clips</h2>
          <Link href="/clips" className="whitespace-nowrap text-[13px] text-foreground/50 transition-colors hover:text-foreground">
            All clips →
          </Link>
        </div>

        {recentFailed ? (
          <p className="mt-4 text-sm text-red-300">Couldn't load your clips just now — refresh to try again.</p>
        ) : recent === null ? (
          <p className="mt-4 text-sm text-foreground/50" style={{ animation: "pulse-soft 1.8s ease-in-out infinite" }}>
            Loading…
          </p>
        ) : recent.length === 0 ? (
          <p className="mt-4 text-sm text-foreground/55">
            Nothing yet — cut a moment from a video and it lands here.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {recent.map((clip) => (
              <div key={clip.id} className="overflow-hidden rounded-lg bg-black/35 ring-1 ring-white/10">
                {playingId === clip.id && clip.url ? (
                  <video src={clip.url} controls autoPlay playsInline className="aspect-video w-full bg-black" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlayingId(clip.id)}
                    disabled={!clip.url}
                    aria-label={`Play: ${clip.description}`}
                    className="group relative block aspect-video w-full bg-black/60 disabled:cursor-default"
                  >
                    {clip.thumbnailUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={clip.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                    {clip.url && (
                      <span className="absolute inset-0 m-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 transition-transform group-hover:scale-105">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
                        </svg>
                      </span>
                    )}
                  </button>
                )}
                <p className="truncate px-2 py-1.5 text-[11.5px] text-foreground/60">{clip.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* The section that cannot be real yet, saying so plainly. Dashes are
            "no data exists", which is true; zeros would claim a measurement
            that never happened. */}
        <div className="mt-10 rounded-xl bg-black/25 p-4 ring-1 ring-white/10">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div>
              <h2 className="text-[15px] font-medium text-foreground/80">Post performance</h2>
              <p className="mt-1 text-[13px] text-foreground/50">
                Views, likes and shares appear here once you connect the accounts you post to.
              </p>
            </div>
            <Link
              href="/publishing"
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] text-foreground/70 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-foreground"
            >
              Connect accounts
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {["Views", "Likes", "Shares"].map((label) => (
              <div key={label} className="rounded-lg bg-black/30 px-4 py-3 ring-1 ring-white/5">
                <p className="text-xl font-medium text-foreground/30">—</p>
                <p className="mt-0.5 text-[12px] text-foreground/40">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
