/**
 * The glyphs on a clip card's action row.
 *
 * The row used to be four text pills — Download, Captions, Publish, Send to
 * workspace — which wrapped onto two lines and gave the card's furniture more
 * weight than the footage it was wrapped around. As icons they sit in one
 * line and the thumbnail leads.
 *
 * Drawn here rather than pulled from an icon set so they match the stroke
 * weight of the rest of the app's hand-drawn marks (the rail, the empty
 * states). Every one is paired with a tooltip AND an aria-label at the call
 * site: an icon alone is a guess for a sighted user and silence for a screen
 * reader.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

export function DownloadGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M12 3v12M7 12l5 5 5-5M5 20h14" />
    </svg>
  )
}

/** Captions: a frame with two lines of text sitting low in it, as on a subtitle. */
export function CaptionsGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M7 14.5h6M15.5 14.5h1.5" />
      <path d="M7 11h3M12.5 11h4.5" />
    </svg>
  )
}

/** Publish: something leaving, upward and out. */
export function PublishGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" />
    </svg>
  )
}

/** Send to workspace: a folder, the same mark the rail uses for a room. */
export function SendToWorkspaceGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4L11 8.5h8.5A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" />
    </svg>
  )
}
