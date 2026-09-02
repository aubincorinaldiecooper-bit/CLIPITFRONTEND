"use client"

import { Children, type ReactNode } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DownloadGlyph } from "@/components/clip-action-icons"
import { ClipComposition, centredComposition, ratioFromLabel } from "@/components/media/clip-composition"
import type { ClipComposition as Composition, LibraryClip } from "@/lib/types"

/**
 * The clip card, after the owner's reference (2026-09-02): a poster-first
 * card in the shape of the carousel cards Airbnb shows — picture on top with
 * a small label pill and one round control over it, then the title and two
 * quiet lines underneath. Pressing the picture opens the clip; the control
 * holds the actions.
 *
 * Deliberately hand-built — media surfaces are the owner's carve-out from the
 * Astryx rework (2026-08-22) — and deliberately ONE component: the library
 * and every workspace room show the same card, and a shared definition is
 * what keeps "same" true. The furniture around it (menu, dialog, buttons)
 * stays on the page's own stack, passed in through `actions`.
 *
 * Every card's picture is the same tall box, because a row of cards only
 * reads as a row when the cards match. A vertical clip fills it exactly — the
 * poster is the file. Anything else (a 16:9 original-framing clip) is shown
 * through the same box centred, cut at the sides, the way a social grid
 * treats a wide picture; the pill on the picture says its true shape, and
 * opening it plays it in that shape. That second part is the decision worth
 * knowing about: a wide clip's card shows the middle of its frame.
 */

const CARD_SHAPE = "9:16"

const NAMED_SHAPES: Array<[string, number]> = [
  ["9:16", 9 / 16],
  ["16:9", 16 / 9],
  ["1:1", 1],
  ["4:5", 4 / 5],
  ["5:4", 5 / 4],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
]

/**
 * The shape a clip is delivered in, as the pill says it: "9:16", "16:9"…
 * Taken from the media block the server built (the file's real shape), else
 * from the source's size, else assumed wide — the shape every clip had before
 * any vertical delivery existed.
 */
export function clipShape(clip: LibraryClip): string {
  const fromMedia = clip.media?.outputAspectRatio ?? clip.media?.composition.aspectRatio ?? null
  const ratio = fromMedia
    ? ratioFromLabel(fromMedia, Number.NaN)
    : clip.sourceWidth && clip.sourceHeight
      ? clip.sourceWidth / clip.sourceHeight
      : Number.NaN
  if (!Number.isFinite(ratio)) return "16:9"
  for (const [label, named] of NAMED_SHAPES) {
    if (Math.abs(ratio - named) / named < 0.03) return label
  }
  return fromMedia ?? `${clip.sourceWidth}:${clip.sourceHeight}`
}

/**
 * The composition the card's tall box uses. A vertical clip brings its own —
 * the same framing its file was cut with. Any other shape is centred in the
 * box, whole frame, cut at the sides.
 */
function cardComposition(clip: LibraryClip): { composition: Composition; source: string | null } {
  const media = clip.media
  if (media && media.composition.aspectRatio === CARD_SHAPE) {
    return { composition: media.composition, source: media.sourceAspectRatio }
  }
  return { composition: centredComposition(CARD_SHAPE), source: clipShape(clip) }
}

/** m:ss, the way every video surface writes a runtime. */
function runtime(clip: LibraryClip): string | null {
  const measured = clip.durationSeconds ?? clip.endSeconds - clip.startSeconds
  const seconds = Math.round(measured)
  return Number.isFinite(seconds) && seconds > 0
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
    : null
}

function cutOn(clip: LibraryClip): string {
  return new Date(clip.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l11-6.86a1.05 1.05 0 0 0 0-1.76l-11-6.86A1.03 1.03 0 0 0 8 5.14Z" />
    </svg>
  )
}

export function ClipCard({
  clip,
  onOpen,
  showDate = false,
  surface = "dark",
  actions,
  children,
}: {
  clip: LibraryClip
  /** Pressing the picture. The page decides what opening means (the viewer). */
  onOpen: () => void
  /** The library shows when a clip was cut; a room's feed does not. */
  showDate?: boolean
  /**
   * Which ground the card is standing on. The library and the rest of the app
   * are near-black ("dark"); the shared rooms are the off-white pilot
   * ("light"). Same card either way; only its own fill and hairline change,
   * because a ring drawn for near-black vanishes on paper.
   */
  surface?: "dark" | "light"
  /** The action rows for the menu: Download, Edit, Rename, Delete, Take out… */
  actions?: ReactNode
  /** Anything below the text (nothing today). */
  children?: ReactNode
}) {
  const poster = clip.media?.posterUrl ?? clip.thumbnailUrl
  const duration = runtime(clip)
  const shape = clipShape(clip)
  const { composition, source } = cardComposition(clip)
  const title = clip.description || "A moment from your video"

  return (
    <article
      className={
        "group relative flex w-full flex-col overflow-hidden rounded-xl " +
        (surface === "light" ? "bg-shcard ring-1 ring-shborder" : "bg-surface ring-1 ring-white/[0.07]")
      }
    >
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          disabled={!clip.url}
          aria-label={`Open: ${title}`}
          className="block w-full text-left disabled:cursor-default"
        >
          <ClipComposition composition={composition} sourceAspectRatio={source} finished className="w-full overflow-hidden bg-black">
            {(style) =>
              poster ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={poster}
                  alt=""
                  loading="lazy"
                  style={style}
                  className="h-full w-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-white/50">
                  <PlayGlyph className="size-8" />
                </span>
              )
            }
          </ClipComposition>
          {/* The pill: the clip's true shape, where the reference keeps its
              category label. It matters most on a wide clip, whose card shows
              the middle of the frame. */}
          <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-black">
            {shape}
          </span>
          {clip.url && (
            <span className="absolute bottom-2 left-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30">
              <PlayGlyph />
            </span>
          )}
          {duration && (
            <span className="absolute bottom-2 right-2 rounded-[5px] bg-black/80 px-1.5 py-0.5 font-mono text-[11.5px] font-medium tabular-nums text-white">
              {duration}
            </span>
          )}
        </button>

        {actions && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${title}`}
                className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/85 text-neutral-800 shadow-sm backdrop-blur-sm hover:bg-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="shadcn-scope w-48 p-1">
              <div className="flex flex-col *:w-full">{actions}</div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="flex flex-col gap-0.5 px-2.5 pb-3 pt-2.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug tracking-tight text-foreground">{title}</h3>
        <p className="truncate text-xs text-foreground/60">{clip.videoTitle ?? "Your video"}</p>
        {showDate && <p className="text-xs text-foreground/60">Cut {cutOn(clip)}</p>}
        {children}
      </div>
    </article>
  )
}

/**
 * One row of the actions menu. The same element sits in the card's menu and
 * along the bottom of the viewer, so an action reads the same in both.
 */
export function ClipMenuItem({
  label,
  icon,
  onClick,
  tone = "default",
}: {
  label: string
  icon?: IconSvgElement
  onClick?: () => void
  tone?: "default" | "danger"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-shaccent " +
        (tone === "danger" ? "text-destructive" : "text-foreground")
      }
    >
      {icon && <HugeiconsIcon icon={icon} className="size-4" />}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}

/**
 * The Download action both pages use: a plain anchor with `download`, not a
 * routed link — the browser must save the signed file directly, and no button
 * component can stand in for that. Dressed as a menu row so it reads as one
 * of the set.
 */
export function ClipDownloadAction({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-shaccent"
    >
      <DownloadGlyph />
      <span className="whitespace-nowrap">Download</span>
    </a>
  )
}

/**
 * Opening a clip: the file plays in its TRUE shape — a wide clip wide, a
 * vertical one tall — with the same framing component every other surface
 * uses, so what opens is the file the card stood for and nothing else.
 */
export function ClipViewer({
  clip,
  onClose,
  showDate = false,
  actions,
}: {
  clip: LibraryClip | null
  onClose: () => void
  showDate?: boolean
  /** The same action rows the card's menu holds, laid along the bottom. */
  actions?: ReactNode
}) {
  const shape = clip ? clipShape(clip) : CARD_SHAPE
  const tall = ratioFromLabel(shape, 1) < 1
  const title = clip?.description || "A moment from your video"

  return (
    <Dialog
      open={clip !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className={"shadcn-scope gap-0 overflow-hidden p-0 " + (tall ? "sm:max-w-[440px]" : "sm:max-w-[960px]")}>
        {clip && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{clip.videoTitle ?? "Your video"}</DialogDescription>
            </DialogHeader>
            <ClipComposition
              composition={clip.media?.composition ?? centredComposition(shape)}
              sourceAspectRatio={clip.media?.sourceAspectRatio ?? shape}
              finished
              className="w-full bg-black"
            >
              {(style) => (
                <video
                  key={clip.id}
                  src={clip.url ?? undefined}
                  poster={clip.media?.posterUrl ?? clip.thumbnailUrl ?? undefined}
                  controls
                  autoPlay
                  playsInline
                  style={style}
                  className="h-full w-full"
                />
              )}
            </ClipComposition>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium leading-snug">{title}</p>
                <p className="text-xs text-foreground/60">
                  {clip.videoTitle ?? "Your video"}
                  {showDate ? ` · Cut ${cutOn(clip)}` : ""}
                </p>
              </div>
              {actions && <div className="flex flex-wrap items-center gap-1">{actions}</div>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Keys survive Children.map; the wrapper is what a carousel needs each card to be. */
export function eachCard(children: ReactNode, className: string): ReactNode {
  return Children.map(children, (child) => <div className={className}>{child}</div>)
}
