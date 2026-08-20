/** Shapes returned by the CLIPIT backend. Mirrors its serializers. */

export type VideoStatus =
  | "pending_upload"
  | "queued"
  | "ingesting"
  | "preprocessing"
  | "ready"
  | "failed"

export type TranscriptStatus = "pending" | "queued" | "running" | "ready" | "failed" | "unavailable"

export type ClipRequestStatus = "pending" | "searching" | "completed" | "failed"

export type ClipStatus = "pending" | "generating" | "ready" | "failed"

export type MatchSource = "visual" | "transcript" | "multimodal"

export interface Progress {
  stage: string
  percent: number
  message: string
}

export interface Video {
  id: string
  sourceType: "upload" | "youtube"
  sourceUrl: string | null
  title: string | null
  originalFilename: string | null
  status: VideoStatus
  error: string | null
  progress: Progress
  durationSeconds: number | null
  durationTimecode: string | null
  sizeBytes: number | null
  width: number | null
  height: number | null
  hasAudio: boolean | null
  chunkCount: number
  readyForSearch: boolean
  transcript: {
    status: TranscriptStatus
    source: string | null
    segmentCount: number
    error: string | null
  }
  /** Ingest-time visual understanding: the model reads the video once here. */
  index: {
    status: TranscriptStatus
    sceneCount: number
    error: string | null
  }
  /** Signed source playback URL; present on the detail endpoint once bytes are in storage. */
  playback?: { url: string; expiresAt: string } | null
}

export interface UploadTarget {
  method: "PUT"
  url: string
  storageKey: string
  headers: Record<string, string>
  expiresInSeconds: number
}

export type MatchFeedback = "approved" | "rejected"

export interface ClipMatch {
  id: string
  startSeconds: number
  endSeconds: number
  startTimecode: string
  endTimecode: string
  durationSeconds: number
  description: string
  confidence: number
  source: MatchSource
  quote: string | null
  /** A still from this moment, so the list can be looked at rather than read. */
  thumbnailUrl: string | null
  /**
   * What a person thought of it. `confidence` is the model's opinion of its
   * own answer; this is the only thing on a match that disagrees with it.
   */
  feedback: MatchFeedback | null
  clip: { id: string; status: ClipStatus } | null
}

export interface ClipRequest {
  id: string
  videoId: string
  instruction: string
  mode: string
  resolvedMode: "visual" | "transcript" | "both" | null
  status: ClipRequestStatus
  error: string | null
  progress: {
    stage: string
    percent: number
    chunksTotal: number
    chunksCompleted: number
    chunksFailed: number
    message: string
  }
  failedChunks: Array<{ chunkIndex: number; message: string }>
  /**
   * Which seconds of the video were never examined. A provider can refuse a
   * chunk on content-policy grounds, and the search still completes with the
   * other chunks' results — so without this, "nothing matches" is
   * indistinguishable from the moment genuinely not being there.
   */
  coverage: {
    complete: boolean
    /** False when something is known to be missing but cannot be located. */
    locatable: boolean
    unsearchedSeconds: number
    gaps: Array<{
      startSeconds: number
      endSeconds: number
      startTimecode: string
      endTimecode: string
      reason: string
    }>
    /**
     * Windows that WERE searched, but without their transcript, after a
     * provider refused the text. Their matches are real; what is missing is
     * that a spoken condition could not be checked there.
     */
    degraded: Array<{
      startSeconds: number
      endSeconds: number
      startTimecode: string
      endTimecode: string
      reason: string
    }>
  }
  matches?: ClipMatch[]
}

export interface Clip {
  id: string
  videoId: string
  clipMatchId: string
  status: ClipStatus
  error: string | null
  startSeconds: number
  endSeconds: number
  startTimecode: string
  endTimecode: string
  durationSeconds: number | null
  sizeBytes: number | null
  url: string | null
  /** Signed with an attachment disposition so the browser saves rather than plays. */
  downloadUrl: string | null
  urlExpiresAt: string | null
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}
