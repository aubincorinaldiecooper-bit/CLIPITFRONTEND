import type { SVGProps } from "react"

/**
 * The band of artwork at the top of a modal.
 *
 * A modal that opens as a title and a form reads like a system prompt. The
 * reference the owner shared leads with a picture, and that is what makes it
 * feel like a product rather than a dialog box — so every modal here gets one.
 *
 * Drawn, not photographed, and drawn in film language: frames, a timeline, a
 * crop window, a signal. Each says what its modal is FOR before a word is
 * read, and each is built from theme tokens so it follows the palette.
 *
 * Deliberately geometric — no blurred glows. That look was tried on this
 * product and rejected by the owner; depth here comes from layered shapes and
 * flat gradients between two tokens, which stays crisp at any size.
 */

export type ModalArtKind = "sign-in" | "connect" | "publish" | "captions" | "workspace"

const ink = "var(--color-text-primary)"
const accent = "var(--color-accent)"

/**
 * The tonal steps the shapes are built from.
 *
 * Outline-only read as a diagram — technically correct and visually flat. Real
 * forms need to sit ON something, so each shape is FILLED from this small
 * ladder and edged with a hairline of ink. Three values is enough for
 * foreground, middle and far, and all three come from the theme so the whole
 * band moves with the palette rather than against it.
 */
const near = "var(--color-background-popover)"
const mid = "var(--color-background-card)"
const far = "var(--color-background-body)"

/**
 * Sign in: frames gathered up and carried along. The promise this modal
 * makes is that the clips you already cut come with you.
 */
function SignInArt() {
  return (
    <svg viewBox="0 0 320 132" fill="none" aria-hidden preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      {/* Three frames, receding — work already done, stacked and solid. */}
      <rect x="40" y="44" width="86" height="54" rx="9" fill={far} stroke={ink} strokeOpacity={0.14} strokeWidth="1.5" />
      <rect x="62" y="37" width="94" height="60" rx="10" fill={mid} stroke={ink} strokeOpacity={0.22} strokeWidth="1.5" />
      <rect x="86" y="29" width="106" height="70" rx="12" fill={near} stroke={ink} strokeOpacity={0.38} strokeWidth="1.8" />
      <path
        d="M129 50.5v27c0 1.4 1.5 2.2 2.7 1.5l22-13.5a1.7 1.7 0 0 0 0-3l-22-13.5c-1.2-.7-2.7.1-2.7 1.5Z"
        fill={ink}
        opacity={0.55}
      />
      {/* Carried forward, ending in the one accent. */}
      <path d="M202 64h34" stroke={ink} strokeWidth="2" strokeLinecap="round" opacity={0.35} />
      <path d="M230 54l11 10-11 10" stroke={accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="255" y="44" width="26" height="40" rx="7" fill={mid} stroke={accent} strokeOpacity={0.35} strokeWidth="1.5" />
    </svg>
  )
}

/** Connect: one source, reaching several destinations. */
function ConnectArt() {
  return (
    <svg viewBox="0 0 320 132" fill="none" aria-hidden preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      {/* Lines first, so the discs sit on top of them. */}
      <path d="M118 56c26-13 44-16 64-16" stroke={ink} strokeWidth="1.8" opacity={0.3} strokeLinecap="round" />
      <path d="M118 66h64" stroke={ink} strokeWidth="1.8" opacity={0.45} strokeLinecap="round" />
      <path d="M118 76c26 13 44 16 64 16" stroke={ink} strokeWidth="1.8" opacity={0.3} strokeLinecap="round" />

      <circle cx="94" cy="66" r="26" fill={near} stroke={ink} strokeOpacity={0.38} strokeWidth="1.8" />
      <circle cx="94" cy="66" r="7" fill={accent} />

      <circle cx="196" cy="40" r="15" fill={mid} stroke={ink} strokeOpacity={0.24} strokeWidth="1.5" />
      <circle cx="196" cy="66" r="15" fill={near} stroke={ink} strokeOpacity={0.38} strokeWidth="1.8" />
      <circle cx="196" cy="92" r="15" fill={mid} stroke={ink} strokeOpacity={0.24} strokeWidth="1.5" />
      <path d="M190 66h12M196 60v12" stroke={ink} strokeOpacity={0.45} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Publish: a frame on its way out of the shot. */
function PublishArt() {
  return (
    <svg viewBox="0 0 320 132" fill="none" aria-hidden preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      {/* One frame becoming three — the same clip, cut for each destination. */}
      <rect x="46" y="30" width="98" height="70" rx="12" fill={near} stroke={ink} strokeOpacity={0.38} strokeWidth="1.8" />
      <path d="M84 50v30l24-15-24-15Z" fill={ink} opacity={0.5} />

      <path d="M152 65h22" stroke={ink} strokeWidth="1.8" opacity={0.3} strokeLinecap="round" />
      <path d="M168 57l9 8-9 8" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

      {/* Three shapes, three platforms: tall, wide, square. */}
      <rect x="190" y="26" width="30" height="52" rx="7" fill={mid} stroke={ink} strokeOpacity={0.26} strokeWidth="1.5" />
      <rect x="228" y="38" width="52" height="30" rx="7" fill={mid} stroke={ink} strokeOpacity={0.26} strokeWidth="1.5" />
      <rect x="190" y="86" width="34" height="34" rx="7" fill={mid} stroke={ink} strokeOpacity={0.26} strokeWidth="1.5" />
      <rect x="234" y="86" width="34" height="34" rx="7" fill={far} stroke={accent} strokeOpacity={0.4} strokeWidth="1.5" />
    </svg>
  )
}

/** Captions: words placed on a frame. */
function CaptionsArt() {
  return (
    <svg viewBox="0 0 320 132" fill="none" aria-hidden preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      <rect x="94" y="18" width="132" height="96" rx="14" fill={near} stroke={ink} strokeOpacity={0.38} strokeWidth="1.8" />
      {/* The words, sitting where they were dragged. */}
      <rect x="110" y="76" width="82" height="9" rx="4.5" fill={ink} opacity={0.6} />
      <rect x="110" y="91" width="54" height="9" rx="4.5" fill={accent} opacity={0.85} />
      {/* The handles that say it can be moved. */}
      <g opacity={0.5}>
        <rect x="103" y="69" width="6" height="6" rx="1.5" fill={ink} />
        <rect x="211" y="69" width="6" height="6" rx="1.5" fill={ink} />
        <rect x="103" y="101" width="6" height="6" rx="1.5" fill={ink} />
        <rect x="211" y="101" width="6" height="6" rx="1.5" fill={ink} />
      </g>
    </svg>
  )
}

/** Workspace: a room with people in it. */
function WorkspaceArt() {
  return (
    <svg viewBox="0 0 320 132" fill="none" aria-hidden preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      <rect x="70" y="20" width="180" height="92" rx="14" fill={near} stroke={ink} strokeOpacity={0.38} strokeWidth="1.8" />
      <path d="M70 44h180" stroke={ink} strokeOpacity={0.2} strokeWidth="1.5" />
      <circle cx="84" cy="32" r="3.5" fill={ink} opacity={0.3} />
      <circle cx="96" cy="32" r="3.5" fill={ink} opacity={0.3} />
      {/* The people in it, and the empty place set for one more. */}
      <circle cx="122" cy="80" r="16" fill={mid} stroke={ink} strokeOpacity={0.3} strokeWidth="1.5" />
      <circle cx="160" cy="80" r="16" fill={mid} stroke={ink} strokeOpacity={0.3} strokeWidth="1.5" />
      <circle cx="198" cy="80" r="16" fill={far} stroke={accent} strokeOpacity={0.55} strokeWidth="1.8" strokeDasharray="3 3.5" />
      <path d="M198 73v14M191 80h14" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

const ART: Record<ModalArtKind, () => React.ReactElement> = {
  "sign-in": SignInArt,
  connect: ConnectArt,
  publish: PublishArt,
  captions: CaptionsArt,
  workspace: WorkspaceArt,
}

/**
 * The band itself. Decorative — every modal states its purpose in words
 * directly beneath, so a reader who never sees this loses nothing.
 */
export function ModalArt({ kind, ...props }: { kind: ModalArtKind } & SVGProps<SVGSVGElement>) {
  const Art = ART[kind]
  return (
    <div
      className="-mx-6 -mt-6 mb-1 flex h-[132px] items-center justify-center overflow-hidden border-b border-border px-6"
      aria-hidden
      // The ground lives here rather than inside the drawing: the band is a
      // wide strip and the artwork is not, so painting the gradient in the SVG
      // meant either cropping the art (slice) or letterboxing the gradient
      // (meet). Splitting them lets the strip fill edge to edge while the
      // drawing sits at its own size in the middle of it.
      style={{
        background:
          "linear-gradient(to bottom, var(--color-background-surface), var(--color-background-body))",
      }}
      {...(props as Record<string, never>)}
    >
      <Art />
    </div>
  )
}
