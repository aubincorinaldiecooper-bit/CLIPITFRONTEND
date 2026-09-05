import type { Video } from "@/lib/types"

/**
 * Whether a question can be sent right now, and what to say if not.
 *
 * A question goes as soon as the upload has landed: the answer waits, inside
 * the search, for whatever the video still needs, and the dialogue says
 * what that is. The server says so with `acceptsQuestions`. An older server
 * does not, and for it ready-for-search is the gate it always was — with
 * the words that were true of it.
 */
export interface AskGate {
  accepting: boolean
  /** The line under the box while sending has to wait. Null when nothing is promised. */
  waitingOn: string | null
  /** The box's own placeholder while sending has to wait. */
  placeholder: string | null
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

export function askGate(video: Video | null | undefined): AskGate {
  if (!video) return UPLOADING
  if (video.status === "failed") return CLOSED
  if (video.acceptsQuestions !== undefined) return video.acceptsQuestions ? OPEN : UPLOADING
  return video.readyForSearch ? OPEN : PREPARING
}
