import { centredComposition } from "@/components/media/clip-composition"
import type { Clip, ClipComposition as Composition, ClipMatch, ClipRequest, Video } from "@/lib/types"
import { clipRowFor, downloadUrlOf, productionOf, type Production } from "./production"
import type { Exchange } from "./types"

/**
 * A moment as the screens show it: the evidence — a stretch of the source
 * video — with what has become of it. Built from the conversation the
 * server tells, never from anything decided on the page.
 *
 * These were the moment feed's own helpers (the owner's screen of
 * 2026-09-02). The feed went with the search screens of 2026-09-14; what a
 * moment IS did not change, so its rules live here, with no screen around
 * them, and both the results stage and the moment page read them.
 */

/** What the card plays. */
export interface PreviewSource {
  url: string
  start: number
  end: number | null
  /** The same framing the still used and the export will use. */
  composition: Composition
  sourceAspectRatio: string | null
  /** True for the finished file; false when the source stands in for it. */
  finished: boolean
}

export interface FeedMoment {
  requestId: string
  match: ClipMatch
  clip: Clip | null
  /** The picture shown while the moment is not the one playing. */
  still: string | null
  preview: PreviewSource | null
  decision: "kept" | "skipped" | null
  /** Where the kept moment's file is; null when none was asked for. */
  production: Production | null
  /** The finished file, signed to be saved; null until it exists. */
  downloadUrl: string | null
  /** The system is reworking this moment; its decision is still open. */
  reworking: boolean
}

/**
 * The clip row recorded for a moment, in whatever state it is in. By the
 * id the match names; failing that, by the match the row names — a clip
 * just made on Keep is in the conversation before the match has been
 * re-read with its id, and an already-finished one never prompts a
 * re-read at all (Devin's finding on #87).
 */
function clipForMatch(match: ClipMatch, clips: Clip[]): Clip | null {
  return clipRowFor(match, clips)
}

/**
 * What the player plays for a moment.
 *
 * The finished, framed file when it exists. For a vertical moment only the
 * 9:16 derivative counts; the landscape cut is never shown in its place.
 * Otherwise the source — the watchable proxy when there is one — seeked to
 * the moment and shown THROUGH the same framing. Deciding whether to keep a
 * clip you cannot watch is not a decision.
 */
export function previewFor(
  match: ClipMatch,
  clips: Clip[],
  video: Video | null,
  _request: ClipRequest | null | undefined,
): PreviewSource | null {
  const clip = clipForMatch(match, clips)
  const sourceAspectRatio =
    clip?.media?.sourceAspectRatio ?? (video?.width && video?.height ? `${video.width}:${video.height}` : null)
  // Framed as the server decided — the export is cut from the same numbers.
  // Before it has decided, 9:16 at the centre, for every request: every
  // clip is vertical (the owner's rule, 2026-09-03), so the guess before
  // the server answers is the same shape as the answer.
  const composition = clip?.media?.composition ?? centredComposition("9:16")
  const produced = productionOf(clip, match.clip) === "produced"
  const finished = produced ? (clip?.media ? clip.media.url : (clip?.url ?? null)) : null
  if (finished) return { url: finished, start: 0, end: null, composition, sourceAspectRatio, finished: true }
  const source = video?.playback?.proxyUrl ?? video?.playback?.url
  if (!source) return null
  return { url: source, start: match.startSeconds, end: match.endSeconds, composition, sourceAspectRatio, finished: false }
}

/**
 * Every moment of every question, in the order they were asked, strongest
 * first within a question. Decided moments stay — they are what the person
 * looks back over — so the list is a record, not a queue.
 */
export function feedMoments(exchanges: Exchange[], video: Video | null): FeedMoment[] {
  return exchanges.flatMap(({ request, clips }) =>
    [...(request.matches ?? [])]
      .sort((a, b) => b.confidence - a.confidence)
      .map((match): FeedMoment => {
        const clip = clipForMatch(match, clips)
        return {
          requestId: request.id,
          match,
          clip,
          still: clip?.media?.posterUrl ?? match.thumbnailUrl ?? null,
          preview: previewFor(match, clips, video, request),
          decision: match.feedback === "approved" ? "kept" : match.feedback === "rejected" ? "skipped" : null,
          production: productionOf(clip, match.clip),
          downloadUrl: downloadUrlOf(clip),
          reworking: match.reclipStatus === "pending",
        }
      }),
  )
}

/** Where a list opens: the first moment nobody has decided on. Past the end once every one is decided. */
export function feedCursor(moments: FeedMoment[]): number {
  const index = moments.findIndex((moment) => moment.decision === null)
  return index === -1 ? moments.length : index
}

/**
 * What identifies a file behind a signed URL: its path. A re-signed link
 * changes only the query (signature, expiry); a re-cut writes a NEW file at
 * a new path. So the path is what the player keys itself by — ignore the
 * one, restart on the other.
 */
export function mediaIdentity(url: string): string {
  try {
    return new URL(url, "http://clipit.invalid").pathname
  } catch {
    return url
  }
}

/** m:ss, for a position or a length within a moment. */
export const asClock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

/** Where the moment sits in the original footage, e.g. 0:42–0:53. */
export function formatRange(match: Pick<ClipMatch, "startSeconds" | "endSeconds">): string {
  return `${asClock(match.startSeconds)}–${asClock(match.endSeconds)}`
}

/** What a moment is called where a name is needed and the description is empty. */
export function momentTitle(match: Pick<ClipMatch, "description">): string {
  return match.description || "A moment from your video"
}

/**
 * Where the footage came from, for the badge on the picture: the site for
 * a link, the file's own name for an upload. Nothing is invented — a video
 * with no name is "Your video".
 */
export function videoLabel(video: Pick<Video, "sourceType" | "sourceUrl" | "title" | "originalFilename"> | null | undefined): string {
  if (!video) return "Your video"
  if (video.sourceType === "youtube" && video.sourceUrl) {
    try {
      return new URL(video.sourceUrl).hostname.replace(/^www\./, "")
    } catch {
      // A malformed address is still an address; the title stands in.
    }
  }
  return video.title?.trim() || video.originalFilename?.trim() || "Your video"
}

/**
 * What established the moment, in words rather than in our field names:
 * seen in the picture, heard in the speech, or both together.
 */
export function evidenceWords(match: Pick<ClipMatch, "source">): string {
  if (match.source === "transcript") return "heard"
  if (match.source === "multimodal") return "seen and heard"
  return "seen"
}
