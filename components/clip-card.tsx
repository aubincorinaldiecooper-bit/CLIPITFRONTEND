"use client"

import type { ReactNode } from "react"
import { HStack } from "@astryxdesign/core/Stack"
import type { LibraryClip } from "@/lib/types"

/**
 * The clip card: still, play-in-place video, description, timecode line, and
 * a row of actions the page provides.
 *
 * Deliberately hand-built — media surfaces are the owner's carve-out from the
 * Astryx rework (2026-08-22) — and deliberately ONE component: the library
 * and every workspace room show the same card, and a shared definition is
 * what keeps "same" true. Everything around it (buttons, popovers, layout)
 * stays Astryx, passed in through `actions`.
 */
export function ClipCard({
  clip,
  isPlaying,
  onPlay,
  showDate = false,
  actions,
  children,
}: {
  clip: LibraryClip
  isPlaying: boolean
  onPlay: () => void
  /** The library shows when a clip was cut; a room's feed does not. */
  showDate?: boolean
  /** The action row, page-specific: Download, Publish, Send, Take out… */
  actions?: ReactNode
  /** Anything below the actions (the library has nothing today). */
  children?: ReactNode
}) {
  // m:ss, the way every video surface writes a runtime. A clip whose render
  // never reported a duration still knows the span it was cut from, so the
  // badge falls back to that rather than leaving the card with no timing at
  // all — the timecode range it used to print is gone from the caption line.
  const measured = clip.durationSeconds ?? clip.endSeconds - clip.startSeconds
  const seconds = Math.round(measured)
  const duration =
    Number.isFinite(seconds) && seconds > 0
      ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
      : null

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.07]">
      {isPlaying && clip.url ? (
        <video src={clip.url} controls autoPlay playsInline className="aspect-video w-full bg-black" />
      ) : (
        <button
          type="button"
          onClick={onPlay}
          disabled={!clip.url}
          aria-label={`Play: ${clip.description}`}
          className="group relative block aspect-video w-full bg-black disabled:cursor-default"
        >
          {clip.thumbnailUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={clip.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
          {clip.url && (
            <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/30 transition-transform group-hover:scale-105">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
              </svg>
            </span>
          )}
          {/* How long it runs, where a viewer expects to find it: bottom
              right, over the frame. The old timecode RANGE moved out of the
              caption line entirely — a duration is what you decide with. */}
          {duration && (
            <span className="absolute bottom-2 right-2 rounded-[5px] bg-black/80 px-1.5 py-0.5 font-mono text-[11.5px] font-medium tabular-nums text-white">
              {duration}
            </span>
          )}
        </button>
      )}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <p className="line-clamp-2 min-h-[2.5rem] text-[13.5px] leading-snug text-foreground/90">
            {clip.description || "A moment from your video"}
          </p>
          <p className="truncate text-[12px] text-foreground/60">
            {clip.videoTitle ?? "Your video"}
            {showDate ? ` · ${new Date(clip.createdAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        {actions && (
          <HStack gap={2} align="center" wrap="wrap">
            {actions}
          </HStack>
        )}
        {children}
      </div>
    </div>
  )
}

/**
 * The Download action both pages use: a plain anchor with `download`, not a
 * routed link — the browser must save the signed file directly.
 */
export function ClipDownloadAction({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-black transition-transform active:scale-[0.97]"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
      </svg>
      Download
    </a>
  )
}
