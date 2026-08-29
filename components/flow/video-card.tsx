"use client"

import type { Video } from "@/lib/types"

/**
 * A video in the library, the way a video platform shows one: the frame
 * first, its length in the corner, then a bold title and a quiet line under
 * it.
 *
 * It replaced a pill carrying a raw filename — "How_We_re_Building_a_Billion
 * _Dollar_Company_Episode_1_-_Alex_Slater_1080p_…" — which is a thing a
 * computer wrote, not a title. The frame is the video's own poster, captured
 * at preprocess time.
 */

/** m:ss, or h:mm:ss past the hour — how a player writes a length. */
function runtime(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = whole % 60
  const pad = (value: number) => String(value).padStart(2, "0")
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`
}

/**
 * A filename, made readable.
 *
 * Underscores and dots stand in for the spaces a file system will not take,
 * and camera and download tools tack on resolution, codec and date. Undoing
 * that is the difference between a title and a receipt. The original is kept
 * as the row's tooltip, so nothing is actually hidden.
 */
export function titleFromFilename(name: string): string {
  let text = name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_.]+/g, " ")

  // Hyphens are separators in "factory-tour-full-walkthrough" and a real dash
  // in "Episode 1 - Alex Slater". Both cannot be true at once, so: only when
  // the name has no spaces of its own is the hyphen doing the spacing.
  if (!/\s/.test(text)) text = text.replace(/-+/g, " ")

  return (
    text
      // The tail a camera or downloader adds — resolution, frame rate, codec,
      // container — repeated, because these usually come in strings of two or
      // three ("… 4K 60fps h264").
      .replace(
        /(\s+[-–]?\s*\b(\d{3,4}p|[248]k|uhd|hd|\d{2,3}\s?fps|[hx]\.?26[45]|av1|vp9|aac|hevc|webm|mp4|mov|mkv)\b)+\s*$/gi,
        "",
      )
      .replace(/\s{2,}/g, " ")
      .replace(/\s+[-–]\s*$/, "")
      .trim() || name
  )
}

/** What a video should be called, best source first. */
export function videoTitle(video: Video): string {
  if (video.title && video.title.trim()) return video.title
  if (video.originalFilename) return titleFromFilename(video.originalFilename)
  return video.sourceUrl ?? "Untitled video"
}

/** How long ago, the way a feed says it. */
function when(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? "" : "s"} ago`
  return new Date(iso).toLocaleDateString()
}

export function VideoCard({
  video,
  disabled,
  onOpen,
}: {
  video: Video
  disabled?: boolean
  onOpen: () => void
}) {
  const title = videoTitle(video)
  const seconds = video.durationSeconds
  const stillProcessing = video.status !== "ready"

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      title={video.originalFilename ?? title}
      className="group flex flex-col gap-2.5 text-left disabled:opacity-50"
    >
      <span className="relative block aspect-video w-full overflow-hidden rounded-xl bg-[#0b0e12]">
        {video.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={video.posterUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          /* No frame yet — a video still being read has not reached the step
             that captures one. A quiet mark beats a broken-image box. */
          <span className="flex h-full w-full items-center justify-center text-white/25">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
            </svg>
          </span>
        )}

        {seconds !== null && seconds > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded-[5px] bg-black/80 px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-white">
            {runtime(seconds)}
          </span>
        )}

        {stillProcessing && (
          <span className="absolute left-1.5 top-1.5 rounded-[5px] bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {video.status === "failed" ? "Failed" : "Reading…"}
          </span>
        )}
      </span>

      <span className="flex flex-col gap-0.5">
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{title}</span>
        <span className="text-[13px] text-muted-foreground">{when(video.createdAt)}</span>
      </span>
    </button>
  )
}
