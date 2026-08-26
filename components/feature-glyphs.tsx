import type { SVGProps } from "react"

/**
 * The line icons the dashboard and empty states are built from.
 *
 * Astryx ships a small registry — clock, check, close, search and a handful
 * more — and the owner's designs call for a wider set than that: a camera, a
 * heart, a spark, a folder of people. They are drawn here rather than pulled
 * from an icon package so the whole set shares one stroke weight, one corner
 * radius and one optical size, which is what makes a row of them read as a
 * family instead of a collection.
 *
 * All are 24×24 on a 1.7 stroke, currentColor, and carry no accessible name:
 * every one sits beside a text label that already says what it means, so an
 * icon that also announced itself would just say everything twice.
 */

function Glyph({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

/** A video: the frame, with a play inside it. */
export function VideoGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10.5 9.2v5.6l4.6-2.8-4.6-2.8Z" />
    </Glyph>
  )
}

/** Minutes: a clock. */
export function ClockGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4V12l3.1 1.9" />
    </Glyph>
  )
}

/** A question asked of a video: a speech bubble with a query mark. */
export function QuestionGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M20.5 11.6a7.6 7.6 0 0 1-8.2 7.6 8.8 8.8 0 0 1-2.6-.4L4.5 20.3l1.4-4.4a7.4 7.4 0 0 1-1.4-4.3A7.6 7.6 0 0 1 12.4 4a7.6 7.6 0 0 1 8.1 7.6Z" />
      <path d="M10.4 9.9a2.1 2.1 0 0 1 4 .7c0 1.4-2 2.1-2 2.1" />
      <path d="M12.4 15.4h.01" />
    </Glyph>
  )
}

/** A cut: the scissors. Matches the rail's New clip mark. */
export function ScissorsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="6" cy="6" r="2.8" />
      <circle cx="6" cy="18" r="2.8" />
      <path d="M20 4 8.6 15.4M14.2 14.2 20 20M8.6 8.6 12 12" />
    </Glyph>
  )
}

/** Performance over time: a line climbing across a frame. */
export function TrendGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7 14.5 10.3 11l2.4 2.3L17 8.8" />
      <path d="M17 11.6V8.8h-2.8" />
    </Glyph>
  )
}

/** Views: an eye. */
export function EyeGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M2.6 12S6 6.2 12 6.2 21.4 12 21.4 12 18 17.8 12 17.8 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="2.9" />
    </Glyph>
  )
}

/** Likes: a heart. */
export function HeartGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M12 19.6s-7.5-4.4-7.5-9.3a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6c0 4.9-7.5 9.3-7.5 9.3Z" />
    </Glyph>
  )
}

/** Shares: a box with something leaving it. */
export function ShareGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M4.5 14.4v3.4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.4" />
      <path d="M12 15.2V4.4M8.2 8.2 12 4.4l3.8 3.8" />
    </Glyph>
  )
}

/** Publishing: the broadcast arcs. Matches the rail's Publishing mark. */
export function BroadcastGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="2.1" />
      <path d="M8.1 8.1a5.5 5.5 0 0 0 0 7.8M15.9 15.9a5.5 5.5 0 0 0 0-7.8" />
      <path d="M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 18.7a9.5 9.5 0 0 0 0-13.4" />
    </Glyph>
  )
}

/** Why this is worth doing: a spark. */
export function SparkGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M12 4.2 13.6 9l4.8 1.6-4.8 1.6L12 17l-1.6-4.8L5.6 10.6 10.4 9 12 4.2Z" />
      <path d="M18.6 4v2.6M19.9 5.3h-2.6M6 17.4V19M6.8 18.2H5.2" />
    </Glyph>
  )
}

/** Faster: a bolt. */
export function BoltGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M13.2 3 5.4 13.4h5.6L10.2 21l7.8-10.4h-5.6L13.2 3Z" />
    </Glyph>
  )
}

/** Measured: bars. */
export function BarsGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M6.4 19.4v-5.6M12 19.4V6.2M17.6 19.4v-8.7" />
    </Glyph>
  )
}

/** An account that stays yours: a person. */
export function PersonGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M5.2 19.6a6.9 6.9 0 0 1 13.6 0" />
    </Glyph>
  )
}

/** Inviting someone: a person with a plus. */
export function PersonPlusGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="9.6" cy="8.4" r="3.5" />
      <path d="M3.4 19.6a6.4 6.4 0 0 1 12.4 0" />
      <path d="M18.6 8v5.2M21.2 10.6H16" />
    </Glyph>
  )
}

/** Nothing has happened yet: an empty tray. */
export function InboxGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M3.4 13.4h4.2l1.3 2.4h6.2l1.3-2.4h4.2" />
      <path d="M5.6 5.4h12.8l2.2 8v4.2a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2v-4.2l2.2-8Z" />
    </Glyph>
  )
}
