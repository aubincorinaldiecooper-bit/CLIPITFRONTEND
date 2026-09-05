import type { Clip, MatchFeedback, MatchFeedbackReason } from "@/lib/types"
import { afterFailedKeep } from "./production"

/**
 * A Keep, as the steps it is: approve on the server, then start the file,
 * and on a failure put back only what this press made. The steps are
 * handed in, so the flow can be run and tested without a page around it.
 */
export interface Verdict {
  verdict: MatchFeedback | null
  reason: MatchFeedbackReason | null
}

export interface KeepEffects {
  /** Record the approval on the server. */
  approve(): Promise<void>
  /** Start the file; resolves to the clip the server recorded. */
  produce(): Promise<Clip | null>
  /** Put the moment's verdict back on the server. */
  rollback(verdict: Verdict): Promise<void>
  /** What the card shows. */
  show(verdict: Verdict): void
  /** The verdict the server has not confirmed yet, for the poll to reconcile. */
  pending: { set(verdict: Verdict): void; delete(): void }
  /** Whether this press is still the live one for its moment. */
  isCurrent(): boolean
  /** Ask the server for its own account of the question, and show that. */
  reconcile(): Promise<void>
  /** Tell the person. */
  fail(cause: unknown): void
}

export async function runKeep(previous: Verdict, effects: KeepEffects): Promise<Clip | null> {
  const approved: Verdict = { verdict: "approved", reason: null }
  effects.pending.set(approved)
  effects.show(approved)

  try {
    await effects.approve()
  } catch (cause) {
    if (!effects.isCurrent()) return null
    const back = afterFailedKeep(previous, "approve")
    effects.pending.delete()
    effects.show({ verdict: back.verdict, reason: back.reason })
    effects.fail(cause)
    return null
  }

  try {
    return await effects.produce()
  } catch (cause) {
    if (!effects.isCurrent()) return null
    const back = afterFailedKeep(previous, "produce")
    effects.show({ verdict: back.verdict, reason: back.reason })
    if (back.tellServer) {
      // Waited for, not fired and forgotten: the press is not over until
      // the server has the verdict back, so nothing newer can be overtaken
      // by it (Devin's finding on #88).
      effects.pending.set({ verdict: back.verdict, reason: back.reason })
      try {
        await effects.rollback({ verdict: back.verdict, reason: back.reason })
      } catch {
        // The server kept the approval this press recorded, so that is what
        // the card shows: a kept moment with nothing made, which Keep again
        // makes. Nothing is left pending, and the server is asked for its
        // own account — no poll would come for a moment with nothing made
        // (Devin's finding on #88).
        if (effects.isCurrent()) {
          effects.pending.delete()
          effects.show(approved)
          await effects.reconcile().catch(() => undefined)
        }
      }
    } else {
      effects.pending.delete()
    }
    effects.fail(cause)
    return null
  }
}

/**
 * One at a time per key: a press waits for the one before it, rollback
 * included, so an older rollback can never land after a newer approval.
 */
export function oneAtATime<T>(queue: Map<string, Promise<unknown>>, key: string, run: () => Promise<T>): Promise<T> {
  const prior = queue.get(key) ?? Promise.resolve()
  const next = prior.then(run, run)
  queue.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  )
  return next
}
