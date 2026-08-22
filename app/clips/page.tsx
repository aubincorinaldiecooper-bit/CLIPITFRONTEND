"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import type { LibraryClip } from "@/lib/types"
import { AppShell } from "@/components/app-shell"

/**
 * Everything you have cut, newest first.
 *
 * Each card is the clip's still until you press play, then the clip itself in
 * place — no lightbox, no second page. Download uses the signed attachment
 * URL, so the browser saves the file without this page touching the bytes.
 */
export default function ClipsPage() {
  const [clips, setClips] = useState<LibraryClip[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .listClips()
      .then(({ clips: entries }) => {
        if (!cancelled) setClips(entries)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AppShell active="clips">
      <div className="mx-auto w-full max-w-6xl flex-1 py-8">
        <h1 className="font-serif text-3xl">Your clips</h1>
        <p className="mt-2 text-sm text-foreground/55">
          Every clip you have cut, ready to play or download.
        </p>

        {failed ? (
          <p className="mt-10 text-sm text-red-300">Couldn't load your clips. Refresh to try again.</p>
        ) : clips === null ? (
          <p className="mt-10 text-sm text-foreground/50" style={{ animation: "pulse-soft 1.8s ease-in-out infinite" }}>
            Loading your clips…
          </p>
        ) : clips.length === 0 ? (
          <div className="mt-10">
            <p className="text-sm text-foreground/60">Nothing here yet — cut a moment from a video and it lands here.</p>
            <Link
              href="/start"
              className="mt-4 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black transition-transform active:scale-[0.97] hover:bg-white/90"
            >
              Clip a video
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clips.map((clip) => (
              <div key={clip.id} className="overflow-hidden rounded-xl bg-black/35 ring-1 ring-white/10">
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
                      <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 transition-transform group-hover:scale-105">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
                        </svg>
                      </span>
                    )}
                  </button>
                )}

                <div className="flex flex-col gap-2 p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-[13.5px] leading-snug text-foreground/85">
                    {clip.description || "A moment from your video"}
                  </p>
                  <p className="truncate text-[12px] text-foreground/40">
                    <span className="font-mono tabular-nums">
                      {clip.startTimecode} – {clip.endTimecode}
                    </span>
                    {clip.videoTitle ? ` · ${clip.videoTitle}` : ""}
                    {` · ${new Date(clip.createdAt).toLocaleDateString()}`}
                  </p>
                  {clip.downloadUrl && (
                    <a
                      href={clip.downloadUrl}
                      download
                      className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-medium text-black transition-transform active:scale-[0.97]"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
                      </svg>
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
