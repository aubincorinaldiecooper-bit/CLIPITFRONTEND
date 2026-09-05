import type { ClipRequest, Video } from "@/lib/types"
import type { Production } from "./production"

/**
 * What the dialogue says about a search, out loud. Written the way a person
 * would say it — "segment" and "examine" are ours, not the reader's — and
 * holding the honesty rules the theater held:
 *
 * - Every line comes from a state the server reports. Nothing here is a
 *   timer, and no count is spoken as final before the search has finished.
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

/** Words that ask for every appearance rather than one. */
const EVERY = /\b(every|each|all|how many|any ?time|whenever)\b/i

/**
 * Said the moment a question is taken, before anything has been looked at.
 * It promises to look — not what will be found.
 */
export function acknowledgeLine(instruction: string, followUp: boolean): string {
  if (EVERY.test(instruction)) return followUp ? "I'll look for every one of those too." : "I'll look for every one of those."
  return followUp ? "I'll look for that too." : "I'll look for that."
}

/** The video is between landing and being ready to look through. */
const PREPARING = new Set<Video["status"]>(["queued", "ingesting", "preprocessing"])

/**
 * What the search is doing right now, from the states the server reports:
 * the video still being prepared, its notes still being written, or the
 * footage being watched part by part.
 */
export function progressLine(request: ClipRequest, video: Video | null | undefined): string {
  const total = request.progress?.chunksTotal ?? 0
  const done = request.progress?.chunksCompleted ?? 0
  if (request.status === "searching" && total > 0) {
    return `Watching the footage — ${Math.min(done, total)} of ${total} parts…`
  }
  if (video && PREPARING.has(video.status) && !video.readyForSearch) return "Getting your video ready to look through…"
  const index = video?.index?.status
  if (index === "pending" || index === "queued" || index === "running") return "Reading your video first, then I'll look…"
  return "Looking through your video…"
}

/**
 * Moments found so far, while the search is still running. Worded as
 * provisional on purpose: the footage path folds duplicates as it goes, and
 * the finished count can be lower than this.
 */
export function candidatesLine(request: ClipRequest): string | null {
  if (request.status !== "pending" && request.status !== "searching") return null
  const found = request.progress?.candidatesFound ?? 0
  if (found <= 0) return null
  return found === 1 ? "1 possible moment so far…" : `${found} possible moments so far…`
}

export function answerLine(request: ClipRequest, readThroughSeconds?: number | null, followUp = false): string {
  const count = request.matches?.length ?? 0
  // The server's own error text is NOT repeated here. It is written for
  // whoever is reading the logs — a provider's refusal, a timeout, a code —
  // and the chat is a conversation (the owner's call, 2026-09-03). The exact
  // words are still carried, on the search's activity row, for anyone who
  // opens it; nothing is hidden, it is just not shouted in the middle of a
  // sentence.
  if (request.status === "failed") return "That search didn't finish. Nothing was lost — ask me again."

  // Answered before the whole video had been watched: said in the answer,
  // not in a warning box — the box's words ("couldn't look") would be
  // untrue of a stretch we simply had not reached yet.
  const partial = request.coverage?.gaps?.some((gap) => gap.reason === "not_read_yet") ?? false

  if (partial && count > 0) {
    const found = count === 1 ? "One so far" : `${count} so far`
    // How much of it has been read — the notes' coverage, which the API
    // reports as readThroughSeconds — not how far in: parts finish out of
    // order, so "in" would overstate it.
    const sofar = readThroughSeconds ? ` — I've only read ${describeMinutes(readThroughSeconds)} of it` : ""
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
      : "I couldn't find a clear moment where that happens. Try describing it another way."
  }

  // The count is the finished one: what the server shows once the search
  // has ended, never the running tally. When a number the person wrote
  // held some back, say so — "the best 3 of the 5" is true; "3 moments"
  // alone would leave the other two unmentioned.
  const shown = count === 1 ? "one moment" : `${count} moments`
  const available = request.deck?.availableCandidateCount ?? null
  if (available !== null && available > count) return `Here are the best ${count} of the ${available} I found.`
  // Fewer than were asked for is an answer too, said as one — a tester on
  // 2026-09-04 asked for five, got four, and was told nothing about it.
  const requested = request.deck?.requestedResultCount ?? null
  if (requested !== null && count < requested) return `You asked for ${requested} — I found ${count === 1 ? "one" : count} that ${count === 1 ? "fits" : "fit"}.`
  return followUp ? `Found ${shown} for that too.` : `Found ${shown}.`
}

/** What has become of a kept moment's file, from the state the server reports. */
export function productionLine(description: string, production: Production | null): string {
  const title = description || "that moment"
  if (production === "producing") return `Kept. Cutting "${title}" to 9:16 now.`
  if (production === "produced") return `"${title}" is ready — download it or publish it from the card.`
  if (production === "failed") return `I couldn't finish cutting "${title}". Keep it again to retry.`
  return `Kept "${title}".`
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
