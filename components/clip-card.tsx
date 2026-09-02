"use client"

import { Children, type CSSProperties, type ReactNode } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Cancel01Icon, Download04Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogClose,
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
 * The picture is hand-built — media surfaces are the owner's carve-out from
 * the Astryx rework (2026-08-22) — and deliberately ONE component: the
 * library and every workspace room show the same card, and a shared
 * definition is what keeps "same" true. The furniture around it (the menu,
 * the dialog, the buttons) is the page's own stack: these two pages sit on
 * the shadcn pilot, so the menu is its DropdownMenu and the viewer's row is
 * its Button. A page describes its actions as data (`ClipAction`) and the
 * card decides what furniture each one wears — a menu row on the card, a
 * button in the viewer — so nothing is hand-rolled twice.
 *
 * The card is a THUMBNAIL (owner, 2026-09-02): compact until it is acted on,
 * the way every social platform shows a video before you open it. Its
 * picture is the same small 4:3 box for every clip, the reference's shape.
 * That box cuts every poster a little — top and bottom off a tall one, the
 * sides off a wide one — and the subject's own coordinate on the cut axis,
 * where the render recorded one, keeps the subject in view. The pill says
 * the clip's true shape; the popup is where the clip is seen whole.
 */

/** What a vertical delivery is, and what the popup is shaped like. */
const CARD_SHAPE = "9:16"
/** The thumbnail's box, for every clip: the reference's compact 4:3. */
const CARD_BOX = "4:3"

const NAMED_SHAPES: Array<[string, number]> = [
  ["9:16", 9 / 16],
  ["16:9", 16 / 9],
  ["1:1", 1],
  ["4:5", 4 / 5],
  ["5:4", 5 / 4],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
]

/** One action a page offers on a clip. A link (`href`) downloads; anything else presses. */
export interface ClipAction {
  label: string
  icon?: IconSvgElement
  onClick?: () => void
  /** A signed file to save. Rendered as a real anchor with `download` — no button can stand in for that. */
  href?: string
  tone?: "default" | "danger"
  disabled?: boolean
}

/**
 * The file this clip plays. When the server built a media block, ITS url is
 * the finished file — the 9:16 derivative for a vertical moment — and null
 * while that file does not exist yet. The canonical `url` is the fallback
 * only for an older response that carries no media block at all; it is
 * never a stand-in for a derivative that is missing.
 */
export function playableUrl(clip: LibraryClip): string | null {
  return clip.media ? clip.media.url : clip.url
}

/** A label the server wrote that actually names a ratio — "source" and the like do not. */
function namedRatio(label: string | null | undefined): number | null {
  const ratio = ratioFromLabel(label, Number.NaN)
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null
}

/** The nearest named shape, or the ratio written out. */
function shapeLabel(ratio: number, exact: string | null): string {
  for (const [label, named] of NAMED_SHAPES) {
    if (Math.abs(ratio - named) / named < 0.03) return label
  }
  return exact ?? `${Math.round(ratio * 1000)}:1000`
}

/**
 * The shape a clip is delivered in, as the pill says it: "9:16", "16:9"…
 *
 * In order of who knows best: the media block's delivered shape, when it
 * names one (the server writes "source" when it could not measure, and that
 * is not a shape); then what the server said it delivers — a vertical
 * delivery is 9:16 whatever the source was; then the source's own size; and
 * only then wide, the shape every clip had before any vertical delivery
 * existed.
 */
export function clipShape(clip: LibraryClip): string {
  const delivered = clip.media?.outputAspectRatio ?? clip.media?.composition.aspectRatio ?? null
  const fromMedia = namedRatio(delivered)
  if (fromMedia !== null) return shapeLabel(fromMedia, delivered)
  if (clip.presentation === "vertical") return CARD_SHAPE
  if (clip.sourceWidth && clip.sourceHeight) {
    return shapeLabel(clip.sourceWidth / clip.sourceHeight, `${clip.sourceWidth}:${clip.sourceHeight}`)
  }
  return "16:9"
}

/**
 * The framing the popup plays through: the server's composition when it
 * names a shape, else a centred one in the shape the clip resolves to — so a
 * clip whose media block says "source" is not played through a 9:16 box.
 */
function viewerComposition(clip: LibraryClip, shape: string): Composition {
  const own = clip.media?.composition
  if (own && namedRatio(own.aspectRatio) !== null) return own
  return centredComposition(shape)
}

/** The shape of the video the clip was cut from, when the server named it or measured it. */
function sourceShape(clip: LibraryClip): string {
  const named = clip.media?.sourceAspectRatio ?? null
  if (namedRatio(named) !== null) return named as string
  if (clip.sourceWidth && clip.sourceHeight) {
    return shapeLabel(clip.sourceWidth / clip.sourceHeight, `${clip.sourceWidth}:${clip.sourceHeight}`)
  }
  return clipShape(clip)
}

/**
 * The composition the thumbnail's box uses. The box is 4:3 for every clip,
 * so the picture is cut on one axis: top and bottom off a tall picture, the
 * sides off a wide one. The subject's own coordinate on that axis keeps the
 * subject in view; without one, the middle.
 *
 * Which picture matters. The render's poster is the delivered file's shape,
 * and its vertical coordinate is the source's (a tall poster is cut from the
 * full height). The search still — shown only when no poster was rendered —
 * is a frame of the SOURCE video, in the source's shape, so both of the
 * stored coordinates apply to it directly.
 */
function cardComposition(clip: LibraryClip, picture: "poster" | "still"): { composition: Composition; source: string } {
  const source = picture === "poster" ? clipShape(clip) : sourceShape(clip)
  const tall = ratioFromLabel(source, 16 / 9) < ratioFromLabel(CARD_BOX, 4 / 3)
  const focal = clip.media?.composition ?? null
  // A poster cut from a wider source keeps only a window of it, so its
  // horizontal coordinate is not the source's; the still keeps the whole.
  const horizontal = picture === "still" || !focal?.crop ? focal?.focalX : null
  const along = tall ? focal?.focalY : horizontal
  const focusPct = typeof along === "number" ? Math.round(along * 100) : 50
  return {
    composition: { aspectRatio: CARD_BOX, mode: "original", focalX: null, focalY: null, focusPct, crop: null },
    source,
  }
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
  /** What the page offers on this clip: Download, Edit, Rename, Delete, Take out… */
  actions?: ClipAction[]
  /** Anything below the text (nothing today). */
  children?: ReactNode
}) {
  const poster = clip.media?.posterUrl ?? clip.thumbnailUrl
  const duration = runtime(clip)
  const shape = clipShape(clip)
  const playable = playableUrl(clip)
  const { composition, source } = cardComposition(clip, clip.media?.posterUrl ? "poster" : "still")
  const title = clip.description || "A moment from your video"

  return (
    <article
      className={
        "group relative flex h-[320px] w-full flex-col overflow-hidden rounded-xl " +
        (surface === "light" ? "bg-shcard ring-1 ring-shborder" : "bg-surface ring-1 ring-white/[0.07]")
      }
    >
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          disabled={!playable}
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
              category label. The thumbnail cuts every poster a little, so
              the pill is what says what will open. */}
          <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-black">
            {shape}
          </span>
        </button>

        {actions && actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
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
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="shadcn-scope w-48">
              {actions.map((action) =>
                action.href ? (
                  <DropdownMenuItem key={action.label} asChild disabled={action.disabled}>
                    <a href={action.href} download>
                      <DownloadGlyph />
                      {action.label}
                    </a>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    key={action.label}
                    variant={action.tone === "danger" ? "destructive" : "default"}
                    disabled={action.disabled}
                    onSelect={() => action.onClick?.()}
                  >
                    {action.icon && <HugeiconsIcon icon={action.icon} />}
                    {action.label}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* The reference's text block: a title, a quiet line, and a footer row
          pinned to the bottom so every card ends at the same height. */}
      <div className="flex flex-1 flex-col justify-between gap-2 px-2.5 pb-2.5 pt-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug tracking-tight text-foreground">{title}</h3>
          <p className="truncate text-xs text-foreground/60">{clip.videoTitle ?? "Your video"}</p>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-foreground/70">
          {duration ? (
            <span className="flex items-center gap-1 font-mono tabular-nums">
              {playable && <PlayGlyph className="size-3" />}
              {duration}
            </span>
          ) : (
            <span />
          )}
          {showDate && <span className="truncate text-foreground/60">{cutOn(clip)}</span>}
        </div>
        {children}
      </div>
    </article>
  )
}

/**
 * The rail beside the popup: one round button per action with its name
 * under it, the way a vertical player keeps its controls off the picture.
 * Download stays a real anchor with `download` — the browser must save the
 * signed file directly, and no button can stand in for that — wearing the
 * button's clothes so the rail reads as one set. Standing on the dialog's
 * own dark ground, so the label is white and the buttons are the page's.
 */
function ViewerRail({ actions }: { actions: ClipAction[] }) {
  return (
    <div className="flex flex-row flex-wrap items-start justify-center gap-4 sm:flex-col sm:justify-end sm:pb-3">
      {actions.map((action) => {
        const icon = action.icon ?? (action.href ? Download04Icon : MoreHorizontalIcon)
        return (
          <div key={action.label} className="flex w-18 flex-col items-center gap-1.5 text-center text-[11px] leading-tight">
            {action.href ? (
              <Button asChild variant="secondary" size="icon" className="size-11 rounded-full">
                <a href={action.href} download aria-label={action.label}>
                  <HugeiconsIcon icon={icon} className="size-5" />
                </a>
              </Button>
            ) : (
              <Button
                variant={action.tone === "danger" ? "destructive" : "secondary"}
                size="icon"
                className="size-11 rounded-full"
                aria-label={action.label}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                <HugeiconsIcon icon={icon} className="size-5" />
              </Button>
            )}
            {/* On its own dark pill: the rail stands over whatever page is behind the popup. */}
            <span aria-hidden className="rounded-full bg-black/60 px-2 py-0.5 text-white">
              {action.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Opening a clip: a vertical popup, the shape of the phone the clip is for,
 * the way a Shorts player opens over the page (owner, 2026-09-02). A
 * vertical clip fills it. A wide clip sits inside it at its TRUE shape, on
 * black, never stretched or cut — through the same framing component every
 * other surface uses, so what opens is the file the card stood for. The
 * words sit over the bottom; the actions stand in a rail beside it, or
 * under it on a phone.
 *
 * Sized from the width, so the panel is never taller than the screen: the
 * width is the smallest of the screen less a margin, the height the popup
 * may take turned into a 9:16 width, and a cap; the height follows.
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
  /** The same actions the card's menu holds, as the rail beside the popup. */
  actions?: ClipAction[]
}) {
  const shape = clip ? clipShape(clip) : CARD_SHAPE
  const title = clip?.description || "A moment from your video"

  return (
    <Dialog
      open={clip !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="shadcn-scope w-auto max-w-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
      >
        {clip && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{clip.videoTitle ?? "Your video"}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
              <div
                data-slot="clip-popup"
                className="relative flex aspect-[9/16] w-[min(calc(100vw_-_2rem),calc(88vh_*_9_/_16),470px)] flex-col justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
              >
                <ClipComposition
                  composition={viewerComposition(clip, shape)}
                  sourceAspectRatio={clip.media?.sourceAspectRatio ?? shape}
                  finished
                  className="w-full"
                >
                  {(style) => (
                    <video
                      key={clip.id}
                      src={playableUrl(clip) ?? undefined}
                      poster={clip.media?.posterUrl ?? clip.thumbnailUrl ?? undefined}
                      controls
                      autoPlay
                      playsInline
                      style={style}
                      className="h-full w-full"
                    />
                  )}
                </ClipComposition>
                <DialogClose asChild>
                  <button
                    type="button"
                    aria-label="Close"
                    className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm hover:bg-black/75"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                  </button>
                </DialogClose>
                {/* Over the bottom of the picture, the way a vertical player
                    says its words. Above the browser's own controls. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-14 pt-16 text-white">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{title}</p>
                  <p className="text-xs text-white/75">
                    {clip.videoTitle ?? "Your video"}
                    {showDate ? ` · Cut ${cutOn(clip)}` : ""}
                  </p>
                </div>
              </div>
              {actions && actions.length > 0 && <ViewerRail actions={actions} />}
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
