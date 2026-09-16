import { readSearchParam } from "@/lib/search-params"
import type { Video } from "@/lib/types"

export const WEB_SEARCH_PARAM = "web"

/**
 * Whether a question can be sent right now, and what to say if not.
 *
 * The home box defaults to the person's own footage. Internet search is a
 * deliberate mode, never something Clipit infers just because no file is
 * attached. That keeps a forgotten upload from silently becoming a web
 * search.
 */
export interface AskGate {
  accepting: boolean
  waitingOn: string | null
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
const CLOSED: AskGate = { accepting: false, waitingOn: null, placeholder: null }

export function askAboutVideoGate(video: Video | null | undefined): AskGate {
  if (!video) return UPLOADING
  if (video.status === "failed") return CLOSED
  if (video.acceptsQuestions !== undefined) return video.acceptsQuestions ? OPEN : UPLOADING
  return video.readyForSearch ? OPEN : PREPARING
}

/**
 * With no file selected, Search stays clickable. The click either starts an
 * explicitly toggled web search or produces the missing-video toast.
 */
export function askGate(
  video: Video | null | undefined,
  { attaching = false }: AskGateOptions = {},
): AskGate {
  if (!video) return attaching ? UPLOADING : OPEN
  return askAboutVideoGate(video)
}

/**
 * The page already calls this helper when it decides which backend route to
 * use. SearchHome writes the explicit mode into the address, so that decision
 * survives the component boundary without coupling the page to the toggle UI.
 *
 * No `web` parameter preserves the old helper behavior for callers outside the
 * home composer. SearchHome writes `web=0` on entry, making footage the real
 * default there.
 */
export function askTarget(
  video: Video | null | undefined,
  { attaching = false, internetEnabled }: AskGateOptions = {},
): "video" | "internet" {
  if (video || attaching) return "video"
  if (internetEnabled !== undefined) return internetEnabled ? "internet" : "video"

  const storedMode = readSearchParam(WEB_SEARCH_PARAM)
  if (storedMode === "1") return "internet"
  if (storedMode === "0") return "video"
  return "internet"
}

export function shouldRemindForMissingVideo(
  video: Video | null | undefined,
  { attaching = false, internetEnabled = false }: AskGateOptions = {},
): boolean {
  return !video && !attaching && !internetEnabled
}
