/** How often the page asks a running search how it is doing. */
export const POLL_MS = 2000

/**
 * A read that failed waits longer than one that worked, in case whatever
 * went wrong needs a moment.
 */
export const RETRY_MS = POLL_MS * 3

/**
 * How many failures in a row before the page stops asking.
 *
 * Enough to ride out a blip — about half a minute of trying — and few enough
 * that a search which is never coming back is let go of rather than asked
 * after every few seconds for as long as the tab is open.
 */
export const MAX_FAILURES = 5

/**
 * When to read a search again — or never.
 *
 * Two different silences, and they need different answers. A read that failed
 * because the network hiccuped should be tried again: the scouts carry on
 * whether or not one request got through, and giving up would freeze the
 * screen at whatever it last saw and lose every moment found after it.
 *
 * A search that is never coming back is the other one. The server reports a
 * failed search as an error on every read, so retrying forever means asking
 * a dead search how it is doing every few seconds until the tab closes —
 * work nobody benefits from, on both ends. After enough failures in a row the
 * page stops asking and leaves the trouble on screen.
 *
 * Counting failures rather than reading the error is deliberate. A search
 * that died and a server that is briefly unreachable answer the same way, so
 * there is nothing in one reply to tell them apart; what tells them apart is
 * that one of them recovers.
 */
export type SearchPhase = "loading" | "searching" | "answered" | "failed"

/**
 * Is this search still working?
 *
 * One source of truth, because two places need the answer and they must not
 * disagree: the page keeps polling while a search runs, and the composer
 * refuses to start a second one while a search runs. If those two ever drift
 * apart you get a screen that is still asking for updates while inviting you
 * to throw the search away — or worse, the other way round.
 *
 * `busy` is not this. It covers the request that starts a search and is back
 * to false within milliseconds, while the watching it began runs for minutes.
 * The results panel's Send was guarded on `busy` and so was never really
 * guarded at all.
 */
export function searchIsRunning(phase: SearchPhase | undefined): boolean {
  return phase !== "answered" && phase !== "failed"
}

export function nextRead(outcome: {
  failed: boolean
  phase?: SearchPhase
  /** Reads that have failed in a row, this one included. */
  consecutiveFailures?: number
}): number | null {
  if (outcome.failed) {
    return (outcome.consecutiveFailures ?? 1) >= MAX_FAILURES ? null : RETRY_MS
  }
  // Both ending states are endings. A search that gave up is not going to
  // start again, and asking it every two seconds until the tab closes helps
  // nobody. Asked through the shared judgement so this and the composer's
  // guard cannot drift apart.
  return searchIsRunning(outcome.phase) ? POLL_MS : null
}
