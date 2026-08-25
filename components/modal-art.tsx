import type { SVGProps } from "react"

/**
 * The band at the top of a modal.
 *
 * The owner's anchor is a high-contrast black-and-white photograph — hard
 * light, deep shadow, a figure against a white wall. That is the right answer
 * and better than anything drawn here: three attempts at flat SVG produced a
 * wireframe, then something the owner correctly called generic, then a
 * diagram. Photography carries depth and atmosphere that vector shapes cannot,
 * and monochrome sits inside this near-black palette instead of fighting it.
 *
 * So the band takes a PHOTOGRAPH when one is registered below, and falls back
 * to the drawn artwork when none is. The treatment is fixed in one place so
 * every picture arrives looking like it belongs to the same product:
 *
 *   - forced to greyscale, so a stray colour cast cannot pull the palette
 *     sideways when somebody drops a new image in;
 *   - contrast lifted slightly, because the anchor's character IS its
 *     contrast;
 *   - a gradient from transparent to the panel colour along the bottom, so
 *     the picture resolves into the modal rather than stopping at a hard
 *     line above the title.
 *
 * To use one: put the file in public/modal-art/ and name it in PHOTOGRAPHS.
 * Nothing else needs to change.
 */

export type ModalArtKind = "sign-in" | "connect" | "publish" | "captions" | "workspace"

/**
 * The photograph for each modal, from public/modal-art/.
 *
 * All five are framings of ONE picture — the owner's anchor, a street in hard
 * afternoon light. One photograph rather than five is deliberate: five
 * unrelated stock images would read as decoration bought by the yard, where
 * five moments in the same frame read as a house style. Same place, same
 * light, same treatment, and each modal gets its own part of it:
 *
 *   sign-in    a person walking, wide — somebody arriving
 *   connect    the road and its markings — a route out to somewhere
 *   publish    the spire against open sky — something carried up and out
 *   captions   the wall, and a figure against it — a surface to write on
 *   workspace  two shadows on one wall — a room with people in it
 *
 * Empty entries fall through to the drawn artwork below, so the app is never
 * missing a band if a file is removed.
 */
const PHOTOGRAPHS: Partial<Record<ModalArtKind, string>> = {
  "sign-in": "/modal-art/sign-in.jpg",
  connect: "/modal-art/connect.jpg",
  publish: "/modal-art/publish.jpg",
  captions: "/modal-art/captions.jpg",
  workspace: "/modal-art/workspace.jpg",
}

const ink = "var(--color-text-primary)"
const accent = "var(--color-accent)"
const near = "var(--color-background-popover)"
const mid = "var(--color-background-card)"

const WIDTH = 420
const HEIGHT = 132

/**
 * A repeatable "random" from an index.
 *
 * Deterministic on purpose: the same modal draws the same waveform every time
 * it opens. Artwork that reshuffles on each render reads as a glitch, and it
 * would also make every screenshot test flap.
 */
function noise(index: number, seed: number): number {
  const value = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453
  return value - Math.floor(value)
}

/**
 * The waveform every band is built from.
 *
 * `from`/`to` mark the cut — the bars inside are full height and lit, the ones
 * outside are shorter and dim. That contrast IS the picture: a long recording,
 * and the piece somebody kept.
 */
function Waveform({
  seed,
  regions,
  bars = 110,
}: {
  seed: number
  /** The kept stretches, as [from, to] bar indices. */
  regions: Array<[number, number]>
  bars?: number
}) {
  const gap = WIDTH / bars
  const midline = HEIGHT / 2
  const inAnyCut = (index: number) => regions.some(([from, to]) => index >= from && index <= to)

  return (
    <g>
      {/* The kept stretches, as the faintest lift out of the ground. This is
          what marks them — not a bracket. Amber brackets around every region
          made the band look like a highlighting error, and this product uses
          amber for small marks, never as a wash. */}
      {regions.map(([from, to]) => (
        <rect
          key={`panel-${from}`}
          x={from * gap}
          y={10}
          width={(to + 1 - from) * gap}
          height={HEIGHT - 20}
          rx={9}
          fill={ink}
          opacity={0.045}
        />
      ))}

      {Array.from({ length: bars }, (_, index) => {
        const kept = inAnyCut(index)
        // Two octaves, so the shape has a slow swell AND fine detail rather
        // than the even fuzz a single random pass gives.
        const swell = 0.35 + 0.65 * Math.abs(Math.sin((index / bars) * Math.PI * 2.6 + seed))
        const detail = 0.45 + 0.55 * noise(index, seed)
        const height = (kept ? 52 : 15) * swell * detail + (kept ? 8 : 3)
        return (
          <rect
            key={index}
            x={index * gap + gap * 0.24}
            y={midline - height / 2}
            width={gap * 0.52}
            height={height}
            rx={gap * 0.26}
            fill={ink}
            opacity={kept ? 0.62 : 0.11}
          />
        )
      })}
    </g>
  )
}

/**
 * The playhead — one amber line, and the only amber in the band.
 *
 * The first version bracketed every kept region in amber. Three pairs of
 * yellow lines read as a highlighting mistake rather than a picture, and this
 * palette uses amber for one small mark at a time.
 */
function Playhead({ at, bars = 110 }: { at: number; bars?: number }) {
  const x = (at * WIDTH) / bars
  return (
    <g>
      <path d={`M${x} 8v${HEIGHT - 16}`} stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <circle cx={x} cy={8} r="3.5" fill={accent} />
    </g>
  )
}

/**
 * Sign in: the whole recording, and everything already pulled out of it —
 * three cuts, not one. What you have made is waiting for you.
 */
function SignInArt() {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fill="none" aria-hidden preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <Waveform seed={2.1} regions={[[16, 34], [54, 66], [82, 98]]} />
      <Playhead at={34} />
    </svg>
  )
}

/** Connect: one cut, and the three places it can go. */
function ConnectArt() {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fill="none" aria-hidden preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <Waveform seed={5.7} regions={[[8, 26]]} />
      <Playhead at={26} />
      {/* Out of the cut, into three waiting places. */}
      <path d="M126 66c40-26 66-32 108-32" stroke={ink} strokeWidth="1.6" opacity={0.22} strokeLinecap="round" />
      <path d="M126 66h108" stroke={ink} strokeWidth="1.6" opacity={0.3} strokeLinecap="round" />
      <path d="M126 66c40 26 66 32 108 32" stroke={ink} strokeWidth="1.6" opacity={0.22} strokeLinecap="round" />
      <circle cx="248" cy="34" r="15" fill={mid} stroke={ink} strokeOpacity={0.22} strokeWidth="1.5" />
      <circle cx="248" cy="66" r="15" fill={near} stroke={ink} strokeOpacity={0.34} strokeWidth="1.6" />
      <circle cx="248" cy="98" r="15" fill={mid} stroke={ink} strokeOpacity={0.22} strokeWidth="1.5" />
      <circle cx="290" cy="66" r="17" fill="none" stroke={accent} strokeOpacity={0.5} strokeWidth="1.8" strokeDasharray="3 3.5" />
      <path d="M290 58v16M282 66h16" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/** Publish: the cut, and the three shapes it becomes. */
function PublishArt() {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fill="none" aria-hidden preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <Waveform seed={8.3} regions={[[6, 24]]} />
      <Playhead at={24} />
      <path d="M118 66h26" stroke={ink} strokeWidth="1.6" opacity={0.28} strokeLinecap="round" />
      <path d="M138 58l9 8-9 8" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Tall, wide, square — the three cuts a publish actually makes. */}
      <rect x="162" y="26" width="34" height="60" rx="8" fill={near} stroke={ink} strokeOpacity={0.3} strokeWidth="1.5" />
      <rect x="208" y="40" width="62" height="34" rx="8" fill={near} stroke={ink} strokeOpacity={0.3} strokeWidth="1.5" />
      <rect x="282" y="34" width="46" height="46" rx="8" fill={near} stroke={ink} strokeOpacity={0.3} strokeWidth="1.5" />
      <rect x="340" y="34" width="46" height="46" rx="8" fill="none" stroke={accent} strokeOpacity={0.45} strokeWidth="1.6" strokeDasharray="3 3.5" />
    </svg>
  )
}

/** Captions: the cut, with words laid over the frame it became. */
function CaptionsArt() {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fill="none" aria-hidden preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <Waveform seed={3.4} regions={[[62, 84]]} />
      <Playhead at={84} />
      {/* The frame the words go on, over the quiet part of the timeline. */}
      <rect x="34" y="22" width="136" height="88" rx="12" fill={near} stroke={ink} strokeOpacity={0.34} strokeWidth="1.6" />
      <rect x="50" y="74" width="86" height="9" rx="4.5" fill={ink} opacity={0.55} />
      <rect x="50" y="89" width="56" height="9" rx="4.5" fill={accent} opacity={0.85} />
      <g opacity={0.45}>
        <rect x="43" y="67" width="6" height="6" rx="1.5" fill={ink} />
        <rect x="155" y="67" width="6" height="6" rx="1.5" fill={ink} />
        <rect x="43" y="99" width="6" height="6" rx="1.5" fill={ink} />
        <rect x="155" y="99" width="6" height="6" rx="1.5" fill={ink} />
      </g>
    </svg>
  )
}

/** Workspace: several people's cuts, side by side in one room. */
function WorkspaceArt() {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fill="none" aria-hidden preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <Waveform seed={6.9} regions={[[18, 34], [62, 80]]} />
      <Playhead at={80} />
      {/* Whose cuts they are. */}
      <circle cx="118" cy="106" r="11" fill={near} stroke={ink} strokeOpacity={0.3} strokeWidth="1.4" />
      <circle cx="138" cy="106" r="11" fill={mid} stroke={ink} strokeOpacity={0.24} strokeWidth="1.4" />
      <circle cx="292" cy="106" r="11" fill={near} stroke={ink} strokeOpacity={0.3} strokeWidth="1.4" />
      <circle cx="312" cy="106" r="11" fill="none" stroke={accent} strokeOpacity={0.5} strokeWidth="1.5" strokeDasharray="2.5 3" />
      <path d="M312 101v10M307 106h10" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
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
export function ModalArt({
  kind,
  onClose,
}: {
  kind: ModalArtKind
  /**
   * Closing the dialog. Passed HERE rather than to DialogHeader because the
   * close belongs at the modal's top-right CORNER, and the band occupies that
   * corner. Left on the header, the X landed in the title row beneath the
   * picture, floating mid-panel with nothing to anchor it.
   */
  onClose?: () => void
}) {
  const Art = ART[kind]
  const photograph = PHOTOGRAPHS[kind]

  return (
    <div className="relative -mx-6 -mt-6 mb-1 h-[150px] overflow-hidden">
      {photograph ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photograph}
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
            // Greyscale is enforced rather than assumed: a colour photograph
            // dropped in later would otherwise drag the whole palette with it.
            style={{ filter: "grayscale(1) contrast(1.08)" }}
          />
          {/* The picture resolves INTO the panel instead of stopping at a
              hard line above the title. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--color-background-popover))",
            }}
          />
        </>
      ) : (
        <div
          aria-hidden
          className="h-full w-full border-b border-border"
          style={{
            background:
              "linear-gradient(to bottom, var(--color-background-surface), var(--color-background-body))",
          }}
        >
          <Art />
        </div>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-primary transition-opacity hover:opacity-80"
          // Its own ground, so it stays legible over a bright part of a
          // photograph as readily as over a dark one.
          style={{ backgroundColor: "var(--color-background-body)", opacity: 0.72 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
