"use client"

import { useState } from "react"
import type { ClipMatch, MatchFeedbackReason } from "@/lib/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * The review deck: one moment at a time, three decisions.
 *
 *        ✕            ↻            ✓
 *      Skip        Re-clip       Keep
 *
 * These are not rating buttons. Keep means "this clip works — save it";
 * Skip means "not useful — move on"; ↻ means "right moment, refine the
 * cut". A decision briefly fills its control as confirmation, then the
 * card LEAVES the deck and the next candidate arrives — nothing kept or
 * skipped lingers in the queue. Re-clip is the one action that holds the
 * card: the system reworks the same moment while an overlay says so, and
 * the three controls return for the refined version.
 *
 * Skip stays fast: it persists immediately and the card exits at once. A
 * transient pill then offers Undo and the optional reasons — answering is
 * never required and never blocks the next card. "Timing is off" offers
 * "↻ Re-clip instead", which brings the moment back and refines it,
 * because a poor cut is the system's job to fix, not the reviewer's.
 *
 * Since the owner's screens of 2026-08-30 the deck lives on the light
 * stage panel: tall card, big circular ✕/✓ beneath it on the white ground,
 * ↻ riding the card's corner. On-media furniture (the ↻ disc, the rework
 * overlay, the skip pill) stays dark glass — it sits on footage, not on
 * the panel.
 *
 * Hand-rolled rather than Astryx, on purpose: the deck belongs to the
 * theater, which is custom by the owner's decision (2026-08-22), and no
 * Astryx component is mounted anywhere in the app today (main builds with
 * the shadcn/ui workspace pilot) — an Astryx island here would inherit
 * neither its neighbours' look nor Astryx's theme contract. The ⋯ menu on
 * kept tiles is the shadcn DropdownMenu the rest of the app already uses.
 */

export const REJECTION_REASONS: ReadonlyArray<{ reason: MatchFeedbackReason; label: string }> = [
  { reason: "wrong_moment", label: "Wrong moment" },
  { reason: "missed_moment", label: "Missed what I wanted" },
  { reason: "bad_boundaries", label: "Timing is off" },
  { reason: "not_relevant", label: "Not useful" },
]

/**
 * The active review queue: only moments nobody has decided on, strongest
 * first. Kept and skipped moments have left the deck; a moment mid-Re-clip
 * stays (its decision is still open).
 */
export function deckQueue(matches: ClipMatch[]): ClipMatch[] {
  return matches
    .filter((match) => match.feedback == null)
    .sort((a, b) => b.confidence - a.confidence)
}

function CheckIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function ReclipIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={spinning ? "animate-spin" : undefined}
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

/**
 * The two decision buttons under the card, on the white stage: Skip the
 * quiet outline circle, Keep the solid dark one — the owner's screens.
 * `deciding` fills the chosen control for the beat before the card
 * transitions out; a confirmation of the tap, not a lasting state.
 */
export function DeckControls({
  onSkip,
  onKeep,
  disabled,
  deciding,
}: {
  onSkip: () => void
  onKeep: () => void
  disabled: boolean
  deciding: "keep" | "skip" | null
}) {
  return (
    <div className="flex items-start justify-center gap-6" data-testid="deck-controls">
      <span className="flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="Skip — not useful, move on"
          title="Skip — not useful, move on"
          aria-pressed={deciding === "skip"}
          onClick={onSkip}
          disabled={disabled || deciding !== null}
          className={`flex h-[74px] w-[74px] items-center justify-center rounded-full ring-1 transition-all ${
            deciding === "skip"
              ? "scale-95 bg-red-500 text-white ring-red-500"
              : "bg-shcard text-foreground ring-shborder hover:bg-shaccent"
          } disabled:cursor-default ${deciding === null ? "disabled:opacity-40" : ""}`}
        >
          <CrossIcon />
        </button>
        <span className="whitespace-nowrap text-[15px] text-muted-foreground">Skip</span>
      </span>
      <span className="flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="Keep — this clip works"
          title="Keep — this clip works"
          aria-pressed={deciding === "keep"}
          onClick={onKeep}
          disabled={disabled || deciding !== null}
          className={`flex h-[74px] w-[74px] items-center justify-center rounded-full transition-all ${
            deciding === "keep"
              ? "scale-95 bg-emerald-500 text-white"
              : "bg-shprimary text-primary-foreground hover:opacity-90"
          } disabled:cursor-default ${deciding === null ? "disabled:opacity-40" : ""}`}
        >
          <CheckIcon size={30} />
        </button>
        <span className="whitespace-nowrap text-[15px] text-foreground">Keep</span>
      </span>
    </div>
  )
}

/**
 * A channel's on/off, the owner's control: a real switch, not a tick. Off
 * and unavailable are different — a channel with no connected account is
 * dimmed and cannot be switched on here, and says where to go instead.
 */
export function ChannelToggle({
  on,
  disabled,
  onToggle,
  label,
}: {
  on: boolean
  disabled: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-[34px] w-[60px] shrink-0 rounded-full transition-colors ${
        on ? "bg-shprimary" : "bg-shmuted ring-1 ring-shborder"
      } disabled:cursor-default disabled:opacity-45`}
    >
      <span
        aria-hidden
        className="absolute top-[3px] block h-7 w-7 rounded-full bg-white shadow-sm transition-[left] duration-200"
        style={{ left: on ? 29 : 3 }}
      />
    </button>
  )
}

/**
 * The Re-clip button, riding the card's corner like the reference deck.
 * Same moment, new edit — never a different moment. Dark glass: it sits on
 * footage.
 */
export function ReclipCardButton({
  pending,
  remaining,
  onReclip,
}: {
  pending: boolean
  remaining: number
  onReclip: () => void
}) {
  const disabled = pending || remaining <= 0
  return (
    <button
      type="button"
      onClick={onReclip}
      disabled={disabled}
      aria-label="Re-clip — same moment, new edit"
      title={
        pending
          ? "Reworking this edit…"
          : remaining <= 0
            ? "Re-clip limit reached for this moment"
            : "Re-clip — same moment, new edit"
      }
      className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-black/75 disabled:cursor-default disabled:opacity-50"
    >
      <ReclipIcon spinning={pending} />
    </button>
  )
}

/**
 * Covers the card while the system reworks the cut. The card never leaves —
 * refinement holds it, a decision releases it.
 */
export function RegeneratingOverlay() {
  return (
    <div
      className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-1.5 bg-black/60 backdrop-blur-[2px]"
      data-testid="regenerating-overlay"
    >
      <span className="text-white">
        <ReclipIcon spinning />
      </span>
      <p className="text-[12.5px] font-medium text-white">Reworking this edit…</p>
      <p className="text-[11px] text-white/70">Same moment, better cut</p>
    </div>
  )
}

/**
 * The word after a skip, never in its way. The skip is already persisted
 * and the next card already up when this appears; it offers Undo, the
 * optional reasons, and — for "Timing is off" — the automated recovery,
 * since a right moment with a poor cut is exactly what ↻ exists for.
 * Dark glass: it floats over the card's footage.
 */
export function SkipPill({
  match,
  onUndo,
  onReason,
  onReclipInstead,
}: {
  match: ClipMatch
  onUndo: () => void
  onReason: (reason: MatchFeedbackReason) => void
  onReclipInstead: () => void
}) {
  const canReclip = (match.reclipsRemaining ?? 0) > 0 && match.reclipStatus !== "pending"
  return (
    <div className="pointer-events-auto rounded-xl bg-black/85 p-2.5 ring-1 ring-white/20 backdrop-blur" data-testid="skip-pill">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[12px] text-white/80">
          Skipped <span className="font-mono tabular-nums">{match.startTimecode}</span>
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 whitespace-nowrap text-[12px] font-medium text-amber-300 transition-colors hover:text-amber-200"
        >
          Undo
        </button>
      </div>
      {match.feedbackReason == null ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {REJECTION_REASONS.map(({ reason, label }) => (
            <button
              key={reason}
              type="button"
              onClick={() => onReason(reason)}
              className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] text-white/70 ring-1 ring-white/25 transition-colors hover:bg-white/10 hover:text-white"
            >
              {label}
            </button>
          ))}
        </div>
      ) : match.feedbackReason === "bad_boundaries" && canReclip ? (
        <button
          type="button"
          onClick={onReclipInstead}
          data-testid="reclip-instead"
          className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] text-white/80 ring-1 ring-white/25 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ReclipIcon spinning={false} />
          Re-clip instead — try that cut again
        </button>
      ) : null}
    </div>
  )
}

/**
 * The deck ran out and nothing was kept: the honest fork. With keeps, the
 * kept grid is the end state instead — the outcome is worth looking at.
 */
export function DeckEndState({
  kept,
  total,
  onUploadMore,
}: {
  kept: number
  total: number
  onUploadMore?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-12 text-center" data-testid="deck-end">
      <p className="text-lg font-semibold text-foreground">That&apos;s every moment</p>
      <p className="max-w-[17rem] text-[13px] leading-snug text-muted-foreground">
        {kept === 0
          ? `You skipped all ${total}. Try asking for the moment a different way.`
          : `Find more moments by uploading more video, or work with what you kept.`}
      </p>
      <div className="mt-6 flex w-full max-w-[19rem] flex-col gap-2.5">
        {onUploadMore && (
          <button
            type="button"
            onClick={onUploadMore}
            className="w-full whitespace-nowrap rounded-full bg-shprimary px-4 py-3 text-[13.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            Upload more video
          </button>
        )}
        <a
          href="/clips"
          className={`w-full whitespace-nowrap rounded-full px-4 py-3 text-center text-[13.5px] font-medium transition-colors ${
            onUploadMore
              ? "text-foreground ring-1 ring-shborder hover:bg-shaccent"
              : "bg-shprimary font-semibold text-primary-foreground"
          }`}
        >
          Go to your library
        </a>
      </div>
    </div>
  )
}

/** One tile of the kept grid, with everything the panel knows about it. */
export interface KeptClipTile {
  /** The clip's id when the cut exists; the match id stands in before it. */
  id: string
  title: string
  /** m:ss, or null while the length is not yet known. */
  duration: string | null
  url: string | null
  poster: string | null
  status: "ready" | "cutting" | "failed"
  error: string | null
}

/**
 * What was kept, in the owner's grid: portrait tiles, name and length over
 * the footage, a ⋯ menu per tile, Review and export beneath. Tiles tell the
 * truth about their state — a clip still cutting says so and a failed cut
 * shows its reason, because a grid of green rectangles is not a library.
 *
 * The ⋯ menu carries what a tile can actually do here: Rename and Delete
 * act in place; captions, sharing to a room, and downloading live in the
 * Library, one click away, rather than duplicated into this flow.
 */
export function KeptGrid({
  clips,
  onReview,
  onPublish,
  onRename,
  onDelete,
}: {
  clips: KeptClipTile[]
  /** Move on to publishing what's ready. Absent → the button links to the library. */
  onReview?: () => void
  /** Publish THIS clip on its own — every clip carries the option. */
  onPublish?: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  if (clips.length === 0) return null
  const readyCount = clips.filter((clip) => clip.status === "ready").length
  const cutting = clips.length - readyCount - clips.filter((clip) => clip.status === "failed").length

  const rename = (tile: KeptClipTile) => {
    // window.prompt over a bespoke dialog: one field, one act, and the
    // browser's own affordance is unmistakably "type a name".
    const title = window.prompt("Name this clip", tile.title)
    if (title !== null && title.trim() !== "" && title.trim() !== tile.title) onRename(tile.id, title.trim())
  }

  return (
    <div className="px-1 pb-1" data-testid="kept-grid">
      <p className="pb-3 text-lg font-semibold text-foreground">
        {clips.length} {clips.length === 1 ? "clip" : "clips"} kept
      </p>
      <div className="grid grid-cols-2 gap-3">
        {clips.map((tile) => (
          <div
            key={tile.id}
            className="group relative block aspect-[9/16] overflow-hidden rounded-2xl bg-[#101013] ring-1 ring-shborder"
            data-testid="kept-tile"
          >
            {tile.status === "ready" && tile.url && playingId === tile.id ? (
              <video src={tile.url} controls autoPlay playsInline className="h-full w-full bg-black object-contain" />
            ) : (
              <button
                type="button"
                onClick={() => tile.status === "ready" && tile.url && setPlayingId(tile.id)}
                className="block h-full w-full text-left"
                aria-label={tile.status === "ready" ? `Play ${tile.title}` : tile.title}
              >
                {tile.poster ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={tile.poster} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="block h-full w-full bg-gradient-to-b from-white/10 to-transparent" />
                )}
                {tile.status === "cutting" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white" style={{ animation: "pulse-soft 1.8s ease-in-out infinite" }}>
                      Cutting…
                    </span>
                  </span>
                )}
                {tile.status === "failed" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 p-3">
                    <span className="text-center text-[11px] leading-snug text-red-200">
                      {tile.error ?? "The cut failed. Keep it again to retry."}
                    </span>
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-9 text-left">
                  <span className="block truncate text-[12.5px] font-medium text-white">{tile.title}</span>
                  <span className="block h-4 font-mono text-[11px] tabular-nums text-white/70">{tile.duration ?? ""}</span>
                </span>
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Options for ${tile.title}`}
                  className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-black/75"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {/* Every clip carries its own Publish — the owner's menu.
                    Only a finished cut can go out, so it waits while the
                    clip is still being made rather than failing later. */}
                {onPublish && (
                  <DropdownMenuItem disabled={tile.status !== "ready"} onSelect={() => onPublish(tile.id)}>
                    Publish
                  </DropdownMenuItem>
                )}
                {/* Edit and Share are the Library's — the caption editor and
                    room sharing live there, and pointing at them beats a
                    second, thinner copy inside this flow. */}
                <DropdownMenuItem asChild>
                  <a href="/clips">Edit</a>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={tile.status !== "ready"} onSelect={() => rename(tile)}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/clips">Share</a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={tile.status === "cutting"}
                  onSelect={() => onDelete(tile.id)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {/* One reserved line: "still cutting" news must not reflow the button. */}
      <p className="mt-2 h-4 text-center text-[11.5px] text-muted-foreground">
        {cutting > 0 ? `${cutting} still cutting — ${cutting === 1 ? "it joins" : "they join"} the grid when done` : ""}
      </p>
      {onReview ? (
        <button
          type="button"
          onClick={onReview}
          disabled={readyCount === 0}
          className="mt-1 block w-full whitespace-nowrap rounded-full bg-shprimary px-4 py-3 text-center text-[13.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          Review and export
        </button>
      ) : (
        <a
          href="/clips"
          className="mt-1 block w-full whitespace-nowrap rounded-full bg-shprimary px-4 py-3 text-center text-[13.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          Review and export
        </a>
      )}
    </div>
  )
}
