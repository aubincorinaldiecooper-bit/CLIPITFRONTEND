import type {
  InternetMoment,
  InternetSearchCandidate,
  InternetSearchFailureKind,
  InternetSearchOutcome,
} from "@/lib/types"

/**
 * What the search did, as rows.
 *
 * This is the whole judgement behind the step rows, kept out of the view so
 * it can be tested and so there is one place to look when asking "why is that
 * row green".
 *
 * The rule it exists to hold: a row's state is a claim about work that
 * happened. `done` says that step finished. `failed` says it was tried and
 * broke. `pending` says it never started. They are three different things and
 * the difference is the whole point — a search that died while watching must
 * never leave a green tick on the watching row, and must never show a red
 * cross on the matching row that was never reached.
 *
 * The reference this follows (the owner's TaskRows) drives its rows from a
 * hardcoded timer: row two turns red at 3.9 seconds and green at 5.3, every
 * time, whatever is happening. Nothing here is timed. Every row is derived
 * from the counts the search actually reported.
 */

export type StepState =
  /** Not reached. No claim either way. */
  | "pending"
  /** Happening now. */
  | "running"
  /** Finished, and everything it was meant to do it did. */
  | "done"
  /** Finished, but not over all of it. Not a failure and not a clean finish. */
  | "partial"
  /** Tried and broke. */
  | "failed"
  /** Finished, and the honest answer was zero. Not a failure. */
  | "none"

export interface StepDetail {
  label: string
  meta: string
  /** Present when the line names somewhere real to go. */
  href?: string
  /** A remark rather than a record — rendered quieter, never a link. */
  aside?: boolean
}

export interface SearchStep {
  key: "found" | "watched" | "matched"
  label: string
  /** The count beside the label. Empty while there is nothing true to put there. */
  amount: string
  state: StepState
  details: StepDetail[]
}

export interface SearchStepsInput {
  phase: "loading" | "searching" | "answered" | "failed"
  moments: InternetMoment[]
  candidatesFound: number
  candidatesWatched?: number
  outcome?: InternetSearchOutcome
  failure?: { kind: InternetSearchFailureKind; count: number }
  /** The pages themselves. Absent on an older reply, or before scouts are sent. */
  candidates?: InternetSearchCandidate[]
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

function percentOf(moment: InternetMoment): string {
  if (moment.confidence === undefined) return ""
  return `${Math.round(moment.confidence * 100)}%`
}

function titleOf(moment: InternetMoment): string {
  return moment.title || moment.marks[0]?.description || "A video"
}

export function searchSteps(input: SearchStepsInput): SearchStep[] {
  const { phase, moments, outcome, failure } = input
  const found = Math.max(0, input.candidatesFound)
  const watched = Math.max(0, Math.min(found, input.candidatesWatched ?? 0))
  const ended = phase === "answered" || phase === "failed"
  const broke = phase === "failed"

  // Step one: did discovery turn anything up to watch?
  const foundState: StepState = !ended && found === 0 ? "running" : found > 0 ? "done" : broke ? "failed" : "none"

  // Step two: were any of them actually opened and watched?
  //
  // `failed` here is reserved for "we tried every one of them and got nothing
  // out of any", which is what watch_failed means. Watching some and not all
  // is `partial` — a real, reportable gap, not a breakage.
  let watchedState: StepState
  if (foundState === "running") watchedState = "pending"
  else if (found === 0) watchedState = "pending"
  else if (!ended) watchedState = "running"
  else if (watched === 0) watchedState = "failed"
  else if (broke || watched < found || outcome === "partly_watched") watchedState = "partial"
  else watchedState = "done"

  // Step three: of what was watched, what matched?
  //
  // Zero matches is `none`, never `failed`. Watching seven videos and finding
  // nothing in them is a complete, correct answer; a red cross would call a
  // finished job a broken one. But it is only that answer if the watching
  // happened, so a search that broke leaves this row pending rather than
  // claiming nothing was there.
  let matchedState: StepState
  if (watchedState === "pending") matchedState = "pending"
  else if (watchedState === "failed") matchedState = "pending"
  else if (!ended) matchedState = "running"
  else if (broke) matchedState = moments.length > 0 ? "partial" : "pending"
  else matchedState = moments.length > 0 ? "done" : "none"

  const unwatched = Math.max(0, found - watched)
  const quiet = Math.max(0, watched - moments.length)

  // What discovery turned up. Display text, never links — some of these are
  // pages nobody opened, and the server redacts them for that reason.
  const roll = input.candidates ?? []
  const foundDetails: StepDetail[] = roll.map((candidate) => ({
    label: candidate.page ?? candidate.source ?? "A page we could not read the address of",
    meta: "",
  }))

  const watchedDetails: StepDetail[] = []
  if (watchedState !== "pending" && found > 0) {
    watchedDetails.push({ label: "Opened and watched", meta: String(watched) })

    if (roll.length > 0) {
      // Split, because `found - watched` lumps together two different facts.
      // A run with one watched, two broken and one never handed out would
      // otherwise read "Would not open: 3" over a list showing two that broke
      // and one nobody touched — the summary claiming a failure for a page
      // that was never opened, directly above the lines that say otherwise.
      const tried = roll.filter((candidate) => candidate.state === "unwatched").length
      const never = roll.filter((candidate) => candidate.state === "not_reached").length
      if (tried > 0) {
        watchedDetails.push({
          label: failure ? becauseOf(failure.kind) : "Opened, no watch came back",
          meta: String(tried),
        })
      }
      if (never > 0) watchedDetails.push({ label: "Never reached", meta: String(never) })
    } else if (unwatched > 0) {
      // No pages in the reply, so we cannot tell "tried and broke" from "never
      // got to it". Saying neither is the only honest line available.
      watchedDetails.push({ label: "Not watched", meta: String(unwatched) })
    }
    // And which ones. This is the question people actually have when a search
    // comes back thin, and until the pages were sent it could only be answered
    // by reading the worker's logs.
    for (const candidate of roll) {
      if (candidate.state === "watched" || candidate.state === "watching") continue
      watchedDetails.push({
        label: candidate.page ?? candidate.source ?? "A page we could not read the address of",
        // Two different facts, kept apart on purpose: one was opened and gave
        // nothing back, the other was never opened at all.
        meta: candidate.state === "unwatched" ? "no watch" : "not reached",
        aside: true,
      })
    }
  }

  const matchedDetails: StepDetail[] = moments.map((moment) => ({
    label: titleOf(moment),
    meta: percentOf(moment),
    href: moment.pageUrl,
  }))
  // Without this the listed rows imply they were everything that was watched.
  if (quiet > 0 && matchedState !== "pending") {
    matchedDetails.push({
      label: `${quiet} more ${plural(quiet, "video had", "videos had")} nothing in ${plural(quiet, "it", "them")}`,
      meta: "",
      aside: true,
    })
  }

  return [
    {
      key: "found",
      label: "Searched the internet",
      amount: found > 0 ? `${found} ${plural(found, "video", "videos")}` : ended ? "none" : "",
      state: foundState,
      details: foundDetails,
    },
    {
      key: "watched",
      label: "Watched them",
      amount: found > 0 && watchedState !== "pending" ? `${watched} of ${found}` : "",
      state: watchedState,
      details: watchedDetails,
    },
    {
      key: "matched",
      label: "Found matches",
      amount:
        matchedState === "pending"
          ? ""
          : `${moments.length} ${plural(moments.length, "video", "videos")}`,
      state: matchedState,
      details: matchedDetails,
    },
  ]
}

/** Why a watch did not happen, without repeating an internal error at someone. */
function becauseOf(kind: InternetSearchFailureKind): string {
  switch (kind) {
    case "video_model_unavailable":
      return "The watcher was unavailable"
    case "video_model_failed":
      return "The watching broke part-way"
    case "browser_unavailable":
      return "Would not open"
    case "timed_out":
      return "Ran out of time"
    default:
      return "Could not be opened"
  }
}
