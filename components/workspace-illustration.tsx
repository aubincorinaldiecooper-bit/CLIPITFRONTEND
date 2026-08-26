import { useId } from "react"

/**
 * The picture beside "No workspaces yet".
 *
 * A shared folder with three things orbiting it: someone being invited, clips
 * going in, and a lock — which is the whole proposition of a workspace stated
 * without a sentence. It is drawn rather than photographed because it depicts
 * a thing the product does, not a place; the modals take the photographs.
 *
 * Everything is currentColor at low opacity over a soft radial glow, so it
 * sits in the near-black palette instead of being a bright object dropped onto
 * it. Purely decorative — the three features are listed in words immediately
 * to its left — so it is hidden from screen readers entirely.
 */
export function WorkspaceIllustration({ className }: { className?: string }) {
  // Two of these can never share gradient ids, and a page could grow a second
  // one; ids are per-instance or the later copy reuses the first one's fill.
  const glow = useId()
  const body = useId()
  const tab = useId()

  return (
    // The viewBox crops in on the drawing rather than showing all of it: at the
    // full 0 0 520 330 the folder came out about three quarters the size the
    // design draws it, with dead margin all round.
    <svg viewBox="78 26 364 278" className={className} aria-hidden fill="none">
      <defs>
        <radialGradient id={glow} cx="50%" cy="58%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.13" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.17" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.07" />
        </linearGradient>
        <linearGradient id={tab} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* The ground the whole thing sits on. */}
      <rect x="70" y="30" width="380" height="280" fill={`url(#${glow})`} />

      {/* The orbits, drawn behind the folder so they pass around it. */}
      <g stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.3" strokeDasharray="4 7">
        <path d="M148 214c-28-62 6-128 74-140 66-12 128 26 136 84" />
        <path d="M372 118c26 58-6 120-70 133-62 13-122-22-132-77" />
      </g>

      {/* The folder: tab behind, body in front, both softly filled. */}
      <path
        d="M186 118h58l16 20h-74z"
        fill={`url(#${tab})`}
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <rect
        x="178"
        y="134"
        width="164"
        height="120"
        rx="14"
        fill={`url(#${body})`}
        stroke="currentColor"
        strokeOpacity="0.26"
        strokeWidth="1.4"
      />

      {/* Whose folder it is: people, on its face. */}
      <circle cx="260" cy="192" r="30" fill="currentColor" fillOpacity="0.09" />
      <g stroke="currentColor" strokeOpacity="0.75" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="253" cy="185" r="6.5" />
        <path d="M241 203a12.5 12.5 0 0 1 24 0" />
        <path d="M266 179.5a6.5 6.5 0 0 1 0 11.5M270 203a12 12 0 0 0-6-9.6" />
      </g>

      {/* A shadow under it, so the folder is standing rather than floating. */}
      <ellipse cx="260" cy="262" rx="70" ry="7" fill="currentColor" fillOpacity="0.08" />

      {/* The three things a workspace is for, each in its own ring. */}
      <Orbiter cx={392} cy={84}>
        <circle cx="-3" cy="-4" r="5.5" />
        <path d="M-12 9a9.5 9.5 0 0 1 18 0" />
        <path d="M11 -7v9M15.5 -2.5h-9" />
      </Orbiter>
      <Orbiter cx={140} cy={238}>
        <path d="M-9 4v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4" />
        <path d="M0 6V-9M-6 -3 0 -9l6 6" />
      </Orbiter>
      <Orbiter cx={384} cy={244}>
        <rect x="-8" y="-1" width="16" height="12" rx="3" />
        <path d="M-4.5 -1v-4.5a4.5 4.5 0 0 1 9 0V-1" />
      </Orbiter>

      {/* Small marks in the empty space — the difference between a diagram and
          a picture, and the reason it does not read as a flowchart. */}
      <g stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.3" strokeLinecap="round">
        <path d="M124 108h7M127.5 104.5v7" />
        <path d="M404 158h7M407.5 154.5v7" />
        <path d="M96 186h5M98.5 183.5v5" />
        <path d="M414 296h5M416.5 293.5v5" />
      </g>
      <g fill="currentColor" fillOpacity="0.28">
        <circle cx="150" cy="128" r="2.2" />
        <circle cx="358" cy="60" r="2" />
        <circle cx="428" cy="196" r="2.4" />
        <circle cx="112" cy="256" r="2" />
      </g>
    </svg>
  )
}

/** One of the three ringed marks orbiting the folder. */
function Orbiter({ cx, cy, children }: { cx: number; cy: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r="29" fill="currentColor" fillOpacity="0.07" />
      <circle r="29" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.4" />
      <g stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {children}
      </g>
    </g>
  )
}
