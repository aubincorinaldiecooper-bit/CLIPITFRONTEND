import type { ClipRequest } from "@/lib/types"
import { answerLine, coverageLine, uncertainLine } from "./answer-words"
import type { FeedMoment } from "./moments"
import type { Exchange } from "./types"

/**
 * The rules of the conversation about a video, with no screen around them.
 *
 * They were the dialogue's (the owner's conversation of 2026-09-05) and
 * they did not change when the dialogue's furniture did: which words are
 * a search and which are an edit of the moment on screen, which moment a
 * number names, and what a search says once it has answered.
 */

/** The product's own verbs for this: on their own they mean the moment on screen. */
const RECLIP_VERBS = /\b(re-?clip|re-?cut|recut)\b/i
const REWORK_WORDS = /\b(redo|rework|try (that|it|this) again)\b/i
const EDIT_WORDS = /\b(trim|shorten|tighten|tighter|punchier|edit|zoom|crop|slower|faster|change|cut|caption|captions|remove)\b/i
const THIS_ONE = /\b(this|it|that|this one|the clip|the moment|the cut)\b/i
/** A message that opens like a question about the footage is one, whatever verbs follow. */
const SEARCH_OPENERS = /^\s*(find|show|search|look for|clip every|every time|where|when)\b/i

/**
 * Whether a message is about the moment on screen rather than a search.
 * "cut every time the crowd cheers" and "find when they redo the kitchen"
 * are searches; "tighten this one", "redo it" and "re-cut" are edits. An
 * edit word alone is not enough — it must point at the clip, or be the
 * product's own word for a re-cut — because an edit spends one of the
 * moment's few re-cuts, and a search sent there never happens.
 */
export function isEditRequest(text: string): boolean {
  if (SEARCH_OPENERS.test(text) && !RECLIP_VERBS.test(text)) return false
  return RECLIP_VERBS.test(text) || ((REWORK_WORDS.test(text) || EDIT_WORDS.test(text)) && THIS_ONE.test(text))
}

/** "video 4", "clip 2", "moment 3", "#2", "the 4th one". */
const NUMBERED = /\b(?:video|clip|moment|number|no\.?)\s*#?\s*(\d{1,3})\b/i
const HASHED = /(?:^|\s)#(\d{1,3})\b/
const ORDINAL = /\b(\d{1,3})(?:st|nd|rd|th)\b/i

/**
 * Which moment an edit names, counted the way the stage counts — "video 4"
 * is the fourth card. Null when none is named, in which case the edit is
 * about the moment on screen. A tester on 2026-09-04 wrote "re-cut video
 * 4" from the end card and was told there was no moment on screen; there
 * were four, and she had said which.
 */
export function referencedIndex(text: string): number | null {
  const found = NUMBERED.exec(text) ?? HASHED.exec(text) ?? ORDINAL.exec(text)
  if (!found) return null
  const number = Number(found[1])
  return Number.isInteger(number) && number >= 1 ? number - 1 : null
}

export const isSearching = (exchange: Exchange) =>
  exchange.request.status === "pending" || exchange.request.status === "searching"

/** Where the answer came from, in words rather than in our field names. */
export function sourceWords(request: ClipRequest): string | undefined {
  if (request.answeredFrom === "notes") return "from what I'd noted"
  if (request.answeredFrom === "footage") return "from the footage"
  if (request.resolvedMode === "visual") return "watching"
  if (request.resolvedMode === "transcript") return "listening"
  if (request.resolvedMode === "both") return "watching and listening"
  return undefined
}

/**
 * What the system says about one question once it has answered: the count
 * it finished with, a stretch that could not be looked at, moments seen but
 * not trusted, nothing found. Empty while the search is still running.
 */
export function exchangeLines(exchange: Exchange, readThroughSeconds: number | null | undefined, followUp: boolean): string[] {
  const { request } = exchange
  if (isSearching(exchange)) return []
  return [answerLine(request, readThroughSeconds, followUp), coverageLine(request), uncertainLine(request)].filter(
    (line): line is string => typeof line === "string" && line.length > 0,
  )
}

/** What a re-cut note says right now, from the moment itself. */
export function reclipNoteText(moments: FeedMoment[], matchId: string, fallback: string): string {
  const moment = moments.find((candidate) => candidate.match.id === matchId)
  if (!moment) return fallback
  const title = moment.match.description || "this moment"
  if (moment.reworking) {
    return `Re-cutting "${title}". I can't follow written edit instructions yet, so this is the same moment cut again from the footage around it — not the change you described.`
  }
  if (moment.match.reclipStatus === "failed") {
    return `The re-cut of "${title}" didn't work: ${moment.match.reclipError ?? "nothing changed."}`
  }
  return `Re-cut "${title}" — same moment, new cut. It's on the card now.`
}
