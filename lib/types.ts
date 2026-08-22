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

/**
 * No percentage. Every stage used to carry one and none was measured — the
 * number jumped to 60 the instant a stage began and sat there for the whole
 * job, which reads as stuck rather than busy. The backend no longer sends it.
 */
export interface Progress {
  stage: string
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
    /**
     * How far into the video the notes reach, in seconds. Measured and moving
     * — notes are written chunk by chunk as they are read — so it is the one
     * honest thing to show while a read is running.
     */
    readThroughSeconds?: number
    readThroughTimecode?: string | null
    error: string | null
  }
  createdAt: string
  /** Signed source playback URL; present on the detail endpoint once bytes are in storage. */
  playback?: { url: string; expiresAt: string } | null
}

/**
 * A clip as the library shows it: the cut plus what it is of — the moment's
 * description and still, and the video it came from.
 */
export interface LibraryClip extends Clip {
  description: string
  thumbnailUrl: string | null
  videoTitle: string | null
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
  /** Whether this was recalled from the notes or read off the footage. */
  answeredFrom: "notes" | "footage" | null
  /**
   * Moments the model reported and the backend's confidence threshold
   * discarded. Not results — they cannot be cut into clips. They exist so an
   * answer can admit to a maybe instead of reporting an absence.
   */
  uncertain: Array<{
    startSeconds: number
    endSeconds: number
    startTimecode: string
    endTimecode: string
    confidence: number
    description: string
  }>
  progress: {
    stage: string
    /** Real here: chunks finished out of chunks to do. */
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
    /**
     * Stretches with no answer behind them. `reason` matters: `not_read_yet`
     * means the video had not been watched that far when the question was
     * asked and will be shortly, which the answer says in its own words —
     * everything else is a stretch that could not be looked at.
     */
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
  createdAt: string
}

/** The caller's own activity, counted from their rows. Never estimated. */
export interface ActivityStats {
  videos: number
  minutesOfVideo: number
  questionsAnswered: number
  clipsCut: number
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}
