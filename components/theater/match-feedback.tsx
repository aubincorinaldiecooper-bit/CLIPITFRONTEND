"use client"

import type { ClipMatch, MatchFeedback, MatchFeedbackReason } from "@/lib/types"

/**
 * The judgment row for a moment: 👍 👎 ↻, always icons, always visible.
 *
 * The rules this component exists to hold:
 *
 * - The icons never leave and are never replaced by text. A verdict fills
 *   the chosen icon; the other stays outline. Tapping the filled icon again
 *   takes the verdict back — the undo lives where the action was.
 * - A thumbs-down opens nothing and demands nothing. Four optional reason
 *   chips appear under the row; ignoring them costs nothing. The chosen
 *   chip fills, the same language as the thumbs.
 * - ↻ Re-clip asks the system to re-evaluate this SAME moment and cut it
 *   better. It is available regardless of verdict — nobody has to vote
 *   before asking for a retry — and "Timing is off" surfaces it as the
 *   natural recovery: try that cut again, never "fix it yourself".
 * - While a Re-clip runs the ↻ spins and refuses further taps; a failure is
 *   a quiet line under the row with the button live again; success shows a
 *   small "Re-clipped" mark. The card never resizes on a verdict — the
 *   reason and status rows live in a reserved space below the controls.
 */

export const REJECTION_REASONS: ReadonlyArray<{ reason: MatchFeedbackReason; label: string }> = [
  { reason: "wrong_moment", label: "Wrong moment" },
  { reason: "missed_moment", label: "Missed what I wanted" },
  { reason: "bad_boundaries", label: "Timing is off" },
  { reason: "not_relevant", label: "Not useful" },
]

function ThumbIcon({ down = false, filled }: { down?: boolean; filled: boolean }) {
  // One glyph, two states: outline by default, solid when chosen. Same path
  // the drawer has always used — the fill is the only thing that changes.
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-filled={filled}
    >
      {down ? (
        <>
          <path d="M17 2v12l-5 8a2.5 2.5 0 0 1-2.4-3.2L10.5 15H5a2 2 0 0 1-2-2.4l1.6-8A2 2 0 0 1 6.6 3H17Z" />
          <path d="M17 14h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-3" fill="none" />
        </>
      ) : (
        <>
          <path d="M7 22V10l5-8a2.5 2.5 0 0 1 2.4 3.2L13.5 9H19a2 2 0 0 1 2 2.4l-1.6 8A2 2 0 0 1 17.4 21H7Z" />
          <path d="M7 10H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" fill="none" />
        </>
      )}
    </svg>
  )
}

function ReclipIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="13"
      height="13"
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

export function MatchFeedbackControls({
  match,
  onRate,
  onReclip,
}: {
  match: ClipMatch
  onRate: (verdict: MatchFeedback | null, reason?: MatchFeedbackReason | null) => void
  onReclip: () => void
}) {
  const approved = match.feedback === "approved"
  const rejected = match.feedback === "rejected"
  const reclipPending = match.reclipStatus === "pending"
  const reclipFailed = match.reclipStatus === "failed"
  const reclipsRemaining = match.reclipsRemaining ?? 0
  const reclipDisabled = reclipPending || reclipsRemaining <= 0

  return (
    <div data-testid="match-feedback">
      <span className="flex items-center gap-0.5">
        <button
          type="button"
          aria-pressed={approved}
          onClick={() => onRate(approved ? null : "approved")}
          aria-label={approved ? "Marked as right — click to undo" : "This clip is right"}
          title={approved ? "Marked as right — click to undo" : "This clip is right"}
          className={`rounded-lg p-1.5 transition-colors hover:bg-white/10 ${
            approved ? "text-emerald-300" : "text-white/60 hover:text-emerald-300"
          }`}
        >
          <ThumbIcon filled={approved} />
        </button>
        <button
          type="button"
          aria-pressed={rejected}
          onClick={() => onRate(rejected ? null : "rejected")}
          aria-label={rejected ? "Marked as wrong — click to undo" : "This clip is wrong"}
          title={rejected ? "Marked as wrong — click to undo" : "This clip is wrong"}
          className={`rounded-lg p-1.5 transition-colors hover:bg-white/10 ${
            rejected ? "text-red-300" : "text-white/60 hover:text-red-300"
          }`}
        >
          <ThumbIcon down filled={rejected} />
        </button>
        <button
          type="button"
          onClick={onReclip}
          disabled={reclipDisabled}
          aria-label="Re-clip — re-evaluate this moment"
          title={
            reclipPending
              ? "Re-clipping — finding a better cut"
              : reclipsRemaining <= 0
                ? "Re-clip limit reached for this moment"
                : "Re-clip — re-evaluate this moment"
          }
          className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white/90 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ReclipIcon spinning={reclipPending} />
        </button>
        {(match.reclipCount ?? 0) > 0 && !reclipPending && (
          /* The quiet mark that this cut is a re-evaluation, not the first
             answer. Information, not celebration. */
          <span className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/60 ring-1 ring-white/15">
            Re-clipped
          </span>
        )}
      </span>

      {/* The optional word after a thumbs-down. Never required: 👎 alone is a
          complete answer. The chosen chip fills; choosing "Timing is off"
          also surfaces the automated recovery right where the thought is. */}
      {rejected && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-testid="rejection-reasons">
          {REJECTION_REASONS.map(({ reason, label }) => {
            const chosen = match.feedbackReason === reason
            return (
              <button
                key={reason}
                type="button"
                aria-pressed={chosen}
                onClick={() => onRate("rejected", chosen ? null : reason)}
                className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] ring-1 transition-colors ${
                  chosen
                    ? "bg-white/15 text-white ring-white/30"
                    : "text-white/60 ring-white/20 hover:bg-white/10 hover:text-white/90"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {rejected && match.feedbackReason === "bad_boundaries" && !reclipPending && reclipsRemaining > 0 && (
        <button
          type="button"
          onClick={onReclip}
          data-testid="timing-reclip-hint"
          className="mt-1.5 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[11.5px] text-white/70 ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ReclipIcon spinning={false} />
          Re-clip — try that cut again
        </button>
      )}

      {reclipFailed && !reclipPending && (
        <p className="mt-1.5 text-[11px] text-amber-300/80" data-testid="reclip-failure">
          {match.reclipError ?? "Re-clip didn't work. The original is untouched — try again."}
        </p>
      )}
    </div>
  )
}
