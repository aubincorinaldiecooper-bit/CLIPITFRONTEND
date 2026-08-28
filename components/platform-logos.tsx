"use client"

import { useId } from "react"

/**
 * Each platform's own mark, in its own colours.
 *
 * This reverses a decision, deliberately and on the owner's instruction. The
 * app drew its own monochrome glyphs for a while (see platform-glyphs.tsx) on
 * the reasoning that these are other companies' trademarks and a wall of
 * borrowed brand colour would fight a near-black palette. The owner's mockups
 * put the real marks in, and they are right about what it buys: "Connect
 * Instagram" beside a shape we invented asks the reader to take our word for
 * which service they are about to hand credentials to. The real mark answers
 * that instantly, and being certain which account you are connecting is worth
 * more here than palette discipline.
 *
 * Naming a service you are connecting to is ordinary nominative use. Worth
 * knowing before launch, though: each platform publishes brand guidelines and
 * official asset files, and they generally ask that those files be used rather
 * than redrawn. These are faithful reconstructions, which is fine for building
 * against and should be swapped for the official downloads.
 *
 * The monochrome glyphs stay for places where colour would be noise rather
 * than information.
 */

export type PlatformLogoSize = "sm" | "md"

const BOX: Record<PlatformLogoSize, string> = {
  // Row-sized, for a list of accounts or platforms.
  sm: "h-10 w-10 rounded-xl",
  // Modal-sized. In the connect mockup the mark is the first thing on the
  // panel and is read before the title, which a small one is not.
  md: "h-[72px] w-[72px] rounded-2xl",
}

/** Instagram: the rounded-square camera outline over its warm gradient. */
function InstagramLogo({ size }: { size: PlatformLogoSize }) {
  // The gradient is referenced by id, and more than one of these can be on a
  // page at once — the publishing list draws one per connected account — so
  // the id has to be unique per instance or every later logo reuses the first
  // one's fill.
  const gradientId = useId()
  return (
    <svg viewBox="0 0 48 48" className={`${BOX[size]} shrink-0`} aria-hidden>
      <defs>
        <radialGradient id={gradientId} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="10%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="70%" stopColor="#d6249f" />
          <stop offset="100%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${gradientId})`} />
      <g fill="none" stroke="#fff" strokeWidth="3">
        <rect x="12" y="12" width="24" height="24" rx="7.5" />
        <circle cx="24" cy="24" r="6.2" />
      </g>
      <circle cx="33.2" cy="14.8" r="1.9" fill="#fff" />
    </svg>
  )
}

/** TikTok: the note, offset in cyan and pink on black. */
function TikTokLogo({ size }: { size: PlatformLogoSize }) {
  const note =
    "M28.5 10.5c.6 3.9 3 6.4 7.2 6.9v5.2c-2.7.1-5.2-.7-7.3-2.3v9.9c0 5.6-4.5 10.1-10.1 " +
    "10.1S8.2 35.8 8.2 30.2 12.7 20.1 18.3 20.1c.5 0 1 0 1.5.1v5.4a4.8 4.8 0 1 0 3.4 4.6V10.5h5.3Z"
  return (
    <svg viewBox="0 0 48 48" className={`${BOX[size]} shrink-0`} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#000" />
      {/* The two offset copies are the mark's whole character — a flat white
          note reads as a generic music icon. */}
      <path d={note} fill="#25F4EE" transform="translate(-1.6 -1.2)" />
      <path d={note} fill="#FE2C55" transform="translate(1.6 1.2)" />
      <path d={note} fill="#fff" />
    </svg>
  )
}

/**
 * YouTube: the white play on red, filling the whole mark.
 *
 * It used to draw YouTube's red badge INSIDE a near-black square, which on a
 * pale page read as a black frame around a smaller red shape — the owner's
 * words, and right: TikTok's and X's black IS their mark, but YouTube's is
 * red. The shape is one colour now, the way the other three are.
 */
function YouTubeLogo({ size }: { size: PlatformLogoSize }) {
  return (
    <svg viewBox="0 0 48 48" className={`${BOX[size]} shrink-0`} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#FF0000" />
      <path d="M19.5 16.5v15l13-7.5-13-7.5Z" fill="#fff" />
    </svg>
  )
}

/** X: the wordmark letter, white on black. */
function XLogo({ size }: { size: PlatformLogoSize }) {
  return (
    <svg viewBox="0 0 48 48" className={`${BOX[size]} shrink-0`} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#000" />
      {/* The two strokes of the X, drawn as the mark's own tapered form
          rather than a typed letter — a letter X in whatever font happens to
          be loaded is not the mark. */}
      <path
        d="M27.6 21.9 37.4 10.5h-2.3l-8.5 9.9-6.8-9.9H12l10.3 15-10.3 12h2.3l9-10.5 7.2 10.5h7.8L27.6 21.9Zm-3.2 3.7-1-1.5-8.3-11.9h3.6l6.7 9.6 1 1.5 8.7 12.4h-3.6l-7.1-10.1Z"
        fill="#fff"
      />
    </svg>
  )
}

/**
 * A platform we have no mark for.
 *
 * Deliberately a neutral tile with the platform's initial rather than a
 * guessed logo: showing the wrong company's mark beside "Connect" would be a
 * worse answer than showing no mark at all.
 */
function UnknownLogo({ platform, size }: { platform: string; size: PlatformLogoSize }) {
  return (
    <span
      className={`${BOX[size]} flex shrink-0 items-center justify-center bg-surface text-sm font-semibold uppercase text-secondary ring-1 ring-border`}
      aria-hidden
    >
      {platform.slice(0, 1)}
    </span>
  )
}

export function PlatformLogo({
  platform,
  size = "md",
}: {
  platform: string
  size?: PlatformLogoSize
}) {
  if (platform === "instagram") return <InstagramLogo size={size} />
  if (platform === "tiktok") return <TikTokLogo size={size} />
  if (platform === "youtube") return <YouTubeLogo size={size} />
  if (platform === "x") return <XLogo size={size} />
  return <UnknownLogo platform={platform} size={size} />
}
