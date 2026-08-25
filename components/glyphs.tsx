import type { SVGProps } from "react"

/**
 * A padlock, for the two places the app promises something about safety: the
 * upload screen ("your video is private"), and the connect modal ("we never
 * see that password").
 *
 * Astryx ships no lock, and `Icon` takes an SVG component as readily as one of
 * its own names — so this is passed to `Icon` rather than dropped into a page
 * raw. Sizing and colour then come from the design system like any other icon,
 * which is the part that matters: a hand-placed svg would need its own size
 * and its own colour and would stop matching the moment either changed.
 *
 * Inherits `currentColor` so it takes the text colour beside it.
 */
export function LockGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

/**
 * An arrow rising out of a tray — the drop zone's mark.
 *
 * Astryx ships `arrowUp`, which on its own reads as "sort ascending" rather
 * than "put a file here". The tray underneath is what makes it an upload.
 */
export function UploadGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 15.5V4.5" />
      <path d="M7.5 9 12 4.5 16.5 9" />
      <path d="M4.5 15.5v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.5" />
    </svg>
  )
}
