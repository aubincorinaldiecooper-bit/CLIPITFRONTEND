import type { Video } from "@/lib/types"

/**
 * Whether a question can be sent right now, and what to say if not.
 *
 * There are two things a question can be asked of, and the box tells them
 * apart by what is attached to it. With a video attached, the question is
 * about that video, and it goes as soon as the upload has landed: the answer
 * waits, inside the search, for whatever the video still needs, and the
 * dialogue says what that is. The server says so with `acceptsQuestions`. An
 * older server does not, and for it ready-for-search is the gate it always
 * was — with the words that were true of it.
 *
 * With nothing attached, the question is asked of the internet, and words are
 * all it needs. A file still on its way up is not "nothing attached": someone
 * who has just picked a video means to ask about that video, so the box waits
 * for it rather than quietly searching the web instead.
 */
export interface AskGate {
  accepting: boolean
  /** The line under the box while sending has to wait. Null when nothing is promised. */
  waitingOn: string | null
  /** The box's own placeholder while sending has to wait. */
  placeholder: string | null
}

export interface AskGateOptions {
  /** A file is on its way up, so a video is coming even though none is attached yet. */
  attaching?: boolean
}

const UPLOADING: AskGate = {
  accepting: false,
  waitingOn: "Your video is still uploading — you can type now, then send once it has landed.",
  placeholder: "Your video is still uploading…",
}
const PREPARING: AskGate = {
  accepting: false,
  waitingOn: "Your video is still being prepared — you can type now, then send once it's ready.",
  placeholder: "Your video is still being prepared…",
}
const OPEN: AskGate = { accepting: true, waitingOn: null, placeholder: null }
/** Preparation failed: nothing here will ever become sendable, so no promise is made. */
const CLOSED: AskGate = { accepting: false, waitingOn: null, placeholder: null }

/**
 * The gate for a box that is definitely about a video — the follow-up under
 * the results, and the one on the moment page. Nothing attached means
 * something has gone wrong, not that the internet is the subject.
 */
export function askAboutVideoGate(video: Video | null | undefined): AskGate {
  if (!video) return UPLOADING
  if (video.status === "failed") return CLOSED
  if (video.acceptsQuestions !== undefined) return video.acceptsQuestions ? OPEN : UPLOADING
  return video.readyForSearch ? OPEN : PREPARING
}

/**
 * The gate for the box on the home screen, which takes either kind of
 * question depending on what is attached to it.
 */
export function askGate(
  video: Video | null | undefined,
  { attaching = false }: AskGateOptions = {},
): AskGate {
  // Nothing attached and nothing coming: the question is for the internet,
  // and there is nothing to wait for.
  if (!video) return attaching ? UPLOADING : OPEN
  return askAboutVideoGate(video)
}

/** What this question will be asked of, given what is attached to the box. */
export function askTarget(
  video: Video | null | undefined,
  { attaching = false }: AskGateOptions = {},
): "video" | "internet" {
  return video || attaching ? "video" : "internet"
}
