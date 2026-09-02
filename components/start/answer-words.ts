import type { ClipRequest } from "@/lib/types"

/**
 * What the dialogue says about a search, out loud. Written the way a person
 * would say it — "segment" and "examine" are ours, not the reader's — and
 * holding the honesty rules the theater held:
 *
 * - An answer given before the whole video was watched says so in the
 *   answer, and never calls a not-yet-read stretch a failure.
 * - A stretch that could NOT be looked at is named, because its silence is
 *   not evidence of absence.
 * - Moments seen but not trusted are mentioned rather than silently dropped.
 */

function describeMinutes(seconds: number): string {
  if (seconds < 90) return "a minute"
  return `${Math.round(seconds / 60)} minutes`
}

/** Whole minutes and seconds, for a duration rather than a position. */
export function describeDuration(seconds: number): string {
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes === 0) return `${rest}s`
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

export function answerLine(request: ClipRequest, readThroughSeconds?: number | null): string {
  const count = request.matches?.length ?? 0
  if (request.status === "failed") return request.error ?? "Something went wrong with that search."

  // Answered before the whole video had been watched: said in the answer,
  // not in a warning box — the box's words ("couldn't look") would be
  // untrue of a stretch we simply had not reached yet.
  const partial = request.coverage?.gaps?.some((gap) => gap.reason === "not_read_yet") ?? false

  if (partial && count > 0) {
    const found = count === 1 ? "One so far" : `${count} so far`
    const sofar = readThroughSeconds ? ` — I'm only ${describeMinutes(readThroughSeconds)} in` : ""
    return `${found}${sofar}. Still watching the rest.`
  }

  if (count === 0) {
    // Never claim the video lacks something when part of it went unread.
    if (request.coverage?.complete === false) {
      return "I didn't find that in the parts of the video I could look at."
    }
    const unsure = request.uncertain?.length ?? 0
    return unsure > 0
      ? `I didn't find a clear match — but there ${unsure === 1 ? "is one" : `are ${unsure}`} I'm unsure about.`
      : "I couldn't find that. Try describing the moment a different way."
  }

  const found = count === 1 ? "Found one moment." : `Found ${count} moments.`
  return count === 1
    ? `${found} Keep it, skip it, or have me re-cut it.`
    : `${found} Keep, skip, or re-cut each one.`
}

/** The stretch that could not be looked at, named. Null when the whole video was. */
export function coverageLine(request: ClipRequest): string | null {
  const coverage = request.coverage
  if (!coverage || coverage.complete) return null
  const gaps = (coverage.gaps ?? []).filter((gap) => gap.reason !== "not_read_yet")
  const degraded = coverage.degraded ?? []
  const parts: string[] = []
  if (gaps.length > 0) {
    const where = gaps.map((gap) => `${gap.startTimecode}–${gap.endTimecode}`).join(", ")
    // The length of THESE stretches, not `unsearchedSeconds`, which also
    // counts footage simply not read yet — that is not missing, and the
    // answer line already says it is still being watched.
    const unavailableSeconds = gaps.reduce((total, gap) => total + Math.max(0, gap.endSeconds - gap.startSeconds), 0)
    parts.push(
      `I couldn't look at ${describeDuration(unavailableSeconds)} of this video (${where}), so I'd have missed anything there.`,
    )
  } else if (coverage.locatable === false) {
    parts.push("There's part of this video I couldn't look at, so I may have missed something.")
  }
  if (degraded.length > 0) {
    parts.push(
      `${degraded.length === 1 ? "There's a bit" : `There are ${degraded.length} bits`} where I could see the video but not hear it, so I'd have missed anything that was only said out loud.`,
    )
  }
  return parts.length > 0 ? parts.join(" ") : null
}

/** The moments found and not shown, admitted to. Null when there were none. */
export function uncertainLine(request: ClipRequest): string | null {
  const uncertain = request.uncertain ?? []
  if (uncertain.length === 0) return null
  const where = uncertain.map((moment) => moment.startTimecode).join(", ")
  return `${uncertain.length === 1 ? "There's one moment" : `There are ${uncertain.length} moments`} I spotted but wasn't sure about (${where}). Ask me to look again if one sounds right.`
}
