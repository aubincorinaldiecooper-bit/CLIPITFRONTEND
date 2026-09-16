import type { Video } from "@/lib/types"

/**
 * Whether a question can be sent right now, and what to say if not.
 *
 * The home box defaults to the person's own footage. Internet search is a
 * deliberate mode, never something Clipit infers just because no file is
 * attached. That keeps a forgotten upload from silently becoming a web
 * search.
 *
 * With a video attached, the question goes as soon as the upload has landed:
 * the answer waits, inside the search, for whatever the video still needs,
 * and the dialogue says what that is. The server says so with
 * `acceptsQuestions`. An older server does not, and for it ready-for-search is
 * the gate it always was — with the words that were true of it.
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
  /** The person explicitly chose to search the web instead of attached footage. */
  internetEnabled?: boolean
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
 * The gate for the home composer. With no file selected the send stays
 * available so the person can get the useful "You forgot your video" toast;
 * whether that send is footage or web is decided separately by askTarget.
 */
export function askGate(
  video: Video | null | undefined,
  { attaching = false }: AskGateOptions = {},
): AskGate {
  if (!video) return attaching ? UPLOADING : OPEN
  return askAboutVideoGate(video)
}

/** What this question will be asked of, given the explicit mode and attachment. */
export function askTarget(
  video: Video | null | undefined,
  { attaching = false, internetEnabled = false }: AskGateOptions = {},
): "video" | "internet" {
  if (video || attaching) return "video"
  return internetEnabled ? "internet" : "video"
}

/**
 * True only for the accidental empty-footage case. A file on its way is not
 * forgotten, and explicit web mode never asks for an upload.
 */
export function shouldRemindForMissingVideo(
  video: Video | null | undefined,
  { attaching = false, internetEnabled = false }: AskGateOptions = {},
): boolean {
  return !video && !attaching && !internetEnabled
}
