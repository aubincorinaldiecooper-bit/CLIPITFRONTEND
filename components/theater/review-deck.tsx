"use client"

import type { ClipMatch, MatchFeedbackReason } from "@/lib/types"

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
 * Hand-rolled rather than Astryx, on purpose: the deck lives inside the
 * theater drawer, which is custom by the owner's decision (2026-08-22),
 * and every neighbouring control there speaks this same inline-SVG idiom.
 * No Astryx component is mounted anywhere in the app today (main builds
 * with the shadcn/ui workspace pilot), so an Astryx island here would
 * inherit neither its neighbours' look nor Astryx's theme contract.
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

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
 * The two decision buttons under the card. Skip is the quiet outline
 * circle, Keep the solid one — the reference deck's language. `deciding`
 * fills the chosen control for the beat before the card transitions out;
 * it is a confirmation of the tap, not a lasting state.
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
    <div className="flex items-center justify-center gap-10" data-testid="deck-controls">
      <button
        type="button"
        aria-label="Skip — not useful, move on"
        title="Skip — not useful, move on"
        aria-pressed={deciding === "skip"}
        onClick={onSkip}
        disabled={disabled || deciding !== null}
        className={`flex h-11 w-11 items-center justify-center rounded-full ring-1 transition-colors ${
          deciding === "skip"
            ? "bg-red-400/90 text-black ring-red-300"
            : "text-white/70 ring-white/25 hover:text-white hover:ring-white/60"
        } disabled:cursor-default ${deciding === null ? "disabled:opacity-40" : ""}`}
      >
        <CrossIcon />
      </button>
      <button
        type="button"
        aria-label="Keep — this clip works"
        title="Keep — this clip works"
        aria-pressed={deciding === "keep"}
        onClick={onKeep}
        disabled={disabled || deciding !== null}
        className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
          deciding === "keep"
            ? "bg-emerald-300 text-black"
            : "bg-white text-black hover:bg-white/85"
        } disabled:cursor-default ${deciding === null ? "disabled:opacity-40" : ""}`}
      >
        <CheckIcon />
      </button>
    </div>
  )
}

/**
 * The Re-clip button, riding the card's corner like the reference deck.
 * Same moment, new edit — never a different moment.
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
      className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-black/75 disabled:cursor-default disabled:opacity-50"
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

/** The deck ran out: every moment got a decision. */
export function DeckEndState({ kept, total }: { kept: number; total: number }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-8 text-center" data-testid="deck-end">
      <p className="text-[14px] font-semibold text-white">That&apos;s every moment</p>
      <p className="text-[12.5px] text-white/70">
        {kept === 0
          ? `You skipped all ${total}. Try asking a different way.`
          : `You kept ${kept} of ${total}. ${kept === 1 ? "It's" : "They're"} in your library.`}
      </p>
      {kept > 0 && (
        <a
          href="/clips"
          className="mt-3 whitespace-nowrap rounded-full bg-white px-4 py-2 text-[12.5px] font-medium text-black transition-transform active:scale-[0.97]"
        >
          Open your library
        </a>
      )}
    </div>
  )
}
