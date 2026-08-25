/**
 * A mark per publishing platform.
 *
 * Not the platforms' own logos: those are their trademarks, they are not ours
 * to redraw, and a wall of borrowed brand colour would fight the app's
 * palette. These are our own hand-drawn marks in the app's stroke weight —
 * enough to tell one row from another at a glance, which is the whole job.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

/** TikTok: a note, for a platform built on sound. */
function TikTokGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14 4c.4 2.3 2 3.9 4.5 4.2" />
    </svg>
  )
}

/** YouTube: a play, for a platform you watch. */
function YouTubeGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Instagram: a frame, for a platform of pictures. */
function InstagramGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** A platform we have no mark for yet — a dot, never a wrong logo. */
function UnknownPlatformGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <circle cx="12" cy="12" r="8" />
    </svg>
  )
}

const GLYPHS: Record<string, () => React.ReactElement> = {
  tiktok: TikTokGlyph,
  youtube: YouTubeGlyph,
  instagram: InstagramGlyph,
}

export function PlatformGlyph({ platform }: { platform: string }) {
  const Glyph = GLYPHS[platform] ?? UnknownPlatformGlyph
  return <Glyph />
}
