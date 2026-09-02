"use client"

import { Children, type CSSProperties, type ReactNode } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

/**
 * The shape a clip is delivered in, as the pill says it: "9:16", "16:9"…
 * Taken from the media block the server built (the file's real shape), else
 * from what the server said it delivers, else from the source's size, else
 * assumed wide — the shape every clip had before any vertical delivery
 * existed.
 */
export function clipShape(clip: LibraryClip): string {
  const fromMedia = clip.media?.outputAspectRatio ?? clip.media?.composition.aspectRatio ?? null
  if (!fromMedia && clip.presentation === "vertical") return CARD_SHAPE
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
  /** What the page offers on this clip: Download, Edit, Rename, Delete, Take out… */
  actions?: ClipAction[]
  /** Anything below the text (nothing today). */
  children?: ReactNode
}) {
  const poster = clip.media?.posterUrl ?? clip.thumbnailUrl
  const duration = runtime(clip)
  const shape = clipShape(clip)
  const playable = playableUrl(clip)
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
              category label. It matters most on a wide clip, whose card shows
              the middle of the frame. */}
          <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-black">
            {shape}
          </span>
          {playable && (
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
 * The same actions along the bottom of the viewer, as the page's buttons.
 * Download stays a real anchor with `download` — the browser must save the
 * signed file directly, and no button can stand in for that — wearing the
 * button's clothes so the row reads as one set.
 */
function ViewerActions({ actions }: { actions: ClipAction[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) =>
        action.href ? (
          <Button key={action.label} asChild variant="secondary" size="sm" className="whitespace-nowrap">
            <a href={action.href} download>
              <DownloadGlyph />
              {action.label}
            </a>
          </Button>
        ) : (
          <Button
            key={action.label}
            variant={action.tone === "danger" ? "destructive" : "secondary"}
            size="sm"
            className="whitespace-nowrap"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.icon && <HugeiconsIcon icon={action.icon} />}
            {action.label}
          </Button>
        ),
      )}
    </div>
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
  /** The same actions the card's menu holds, laid along the bottom. */
  actions?: ClipAction[]
}) {
  const shape = clip ? clipShape(clip) : CARD_SHAPE
  const ratio = ratioFromLabel(shape, 9 / 16)
  const tall = ratio < 1
  const title = clip?.description || "A moment from your video"
  // The dialog must fit the screen with the video, the words and the buttons
  // all visible, so its WIDTH is derived from the height that is available:
  // a tall clip on a short screen gets narrower rather than taller. The
  // ratio is data, not a design value, so it reaches CSS as a variable.
  const sizing = { "--clip-ratio": String(ratio) } as CSSProperties

  return (
    <Dialog
      open={clip !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        style={sizing}
        className={
          "shadcn-scope max-h-[92vh] gap-0 overflow-y-auto p-0 max-w-[min(calc(100%_-_2rem),calc((92vh_-_8rem)*var(--clip-ratio)))] " +
          (tall
            ? "sm:max-w-[min(440px,calc((92vh_-_8rem)*var(--clip-ratio)))]"
            : "sm:max-w-[min(960px,calc((92vh_-_8rem)*var(--clip-ratio)))]")
        }
      >
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
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium leading-snug">{title}</p>
                <p className="text-xs text-foreground/60">
                  {clip.videoTitle ?? "Your video"}
                  {showDate ? ` · Cut ${cutOn(clip)}` : ""}
                </p>
              </div>
              {actions && actions.length > 0 && <ViewerActions actions={actions} />}
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
