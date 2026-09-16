/** How often the page asks a running search how it is doing. */
export const POLL_MS = 2000

/**
 * A read that failed waits longer than one that worked, in case whatever
 * went wrong needs a moment. It still happens.
 */
export const RETRY_MS = POLL_MS * 3

/**
 * When to read a search again — or never, because it is finished.
 *
 * The rule worth stating: a read that failed schedules the next one anyway.
 * A search runs for minutes, and the scouts carry on whether or not one
 * request got through. Giving up on a single failure would freeze the screen
 * at whatever it last saw and lose every moment found after it, until someone
 * thought to reload.
 */
export function nextRead(outcome: { failed: boolean; phase?: "loading" | "searching" | "answered" }): number | null {
  if (outcome.failed) return RETRY_MS
  return outcome.phase === "answered" ? null : POLL_MS
}
