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
  playback?: {
    url: string
    expiresAt: string
    /** The watchable 1080-line proxy; the review cards and Preview play this. Null falls back to `url`. */
    proxyUrl?: string | null
  } | null
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
  /** Absent when the upload is part-by-part. */
  url?: string
  /** Present for a big file: the upload's identity; each slice's URL is
   *  asked for fresh, just before it is sent. */
  multipart?: {
    uploadId: string
    partSizeBytes: number
    partCount: number
  }
  storageKey: string
  headers: Record<string, string>
  expiresInSeconds: number
}

export type MatchFeedback = "approved" | "rejected"

/**
 * The owner's evaluation report, exactly as /api/evaluation serialises it.
 * Rates are 0–1 fractions or null when their denominator is zero — the page
 * shows the denominator beside every rate rather than hiding a small sample
 * behind a confident percentage.
 */
export interface EvaluationReport {
  filters: {
    from: string | null
    to: string | null
    provider: string | null
    model: string | null
    promptVersion: string | null
    durationBucket: string | null
    stage?: string | null
  }
  quality: {
    momentsReturned: number
    momentsWithFeedback: number
    keeps: number
    skips: number
    keepRate: number | null
    skipRate: number | null
    reasons: Record<string, number>
    clipsKept: number
    acceptanceRate: number | null
    momentsWithoutAttribution: number
  }
  searches: {
    searchesCompleted: number
    searchesWithResults: number
    searchesCorrected: number
    correctionRate: number | null
    noCorrectionSuccessRate: number | null
    searchesWithExplicitFeedback: number
    searchesMarkedMissed: number
    observedMissRate: number | null
  }
  boundaries: {
    eligibleReviewedMoments: number
    momentsNeverReviewed: number
    firstPassKeeps: number
    firstPassKeepRate: number | null
    momentsReclipped: number
    reclipRate: number | null
    reviewedReclips: number
    keptReclips: number
    reclipKeepRate: number | null
    momentsWithExplicitFeedback: number
    timingIssues: number
    timingIssueRate: number | null
    shifts: {
      reclipsMeasured: number
      averageAbsoluteStartShiftSeconds: number | null
      averageAbsoluteEndShiftSeconds: number | null
      averageSignedStartShiftSeconds: number | null
      averageSignedEndShiftSeconds: number | null
      medianBoundaryShiftSeconds: number | null
      p90BoundaryShiftSeconds: number | null
      withinSeconds: { "1": number | null; "2": number | null; "3": number | null; "5": number | null }
    }
  }
  labelledAccuracy: {
    available: false
    note: string
  }
  economics: {
    sourceVideoHoursAnalyzed: number
    videosAnalyzed: number
    totalAnalysisWallMs: number
    actualReportedCostUsd: number
    estimatedModalCostUsd: number | null
    modalRateUsdPerGpuHour: number | null
    marginalCostPerSourceHourUsd: number | null
    effectiveCostPerSourceHourUsd: null
    inferenceSecondsPerSourceHour: number | null
    initialAnalysisCalls: number
    reclipCalls: number
    initialInferenceMs: number | null
    reclipInferenceMs: number | null
    initialCostUsd: number | null
    reclipCostUsd: number | null
    reclipCostShare: number | null
    analysisMsPerSourceHour: number | null
    segments: Array<{
      provider: string
      model: string
      stage: string
      calls: number
      callsMissingCost: number
      totalCostUsd: number | null
      totalLatencyMs: number
      totalInferenceMs: number | null
      totalDownloadMs: number | null
      totalGpuMsForEstimate: number | null
      estimatedCostUsd: number | null
    }>
  }
  notes: string[]
}

/**
 * Why a moment was waved away — offered once, after a thumbs-down, never
 * demanded. "Missed what I wanted" is the important one: it is the only way
 * to say the RIGHT moment never appeared, which no thumbs-down on a wrong
 * moment can express by itself.
 */
export type MatchFeedbackReason = "wrong_moment" | "missed_moment" | "bad_boundaries" | "not_relevant"

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
  /** The optional word after a thumbs-down; null until (and unless) given. */
  feedbackReason?: MatchFeedbackReason | null
  /**
   * The Re-clip lifecycle: 'pending' while the system re-evaluates this
   * moment (it can take minutes on a cold GPU), 'failed' with a showable
   * reason when the last attempt produced nothing. Null when idle.
   */
  reclipStatus?: "pending" | "failed" | null
  reclipError?: string | null
  /** How many re-evaluations this moment has spent, and how many remain. */
  reclipCount?: number
  reclipsRemaining?: number
  reclippedAt?: string | null
  clip: { id: string; status: ClipStatus } | null
}

export interface ClipRequest {
  id: string
  videoId: string
  instruction: string
  mode: string
  resolvedMode: "visual" | "transcript" | "both" | null
  status: ClipRequestStatus
  /** Present only for a request that named a platform: the vertical deck's state. */
  deck?: {
    requestedResultCount: number | null
    availableCandidateCount: number | null
    effectiveDeckTarget: number | null
    readyResultCount: number
    complete: boolean
  }
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

/** One piece of text burned onto a clip: what, how, and where. */
export interface ClipCaption {
  text: string
  font: "sans" | "serif" | "mono" | "bold"
  /** Text height as % of the video's height. */
  sizePct: number
  /** #rrggbb. */
  color: string
  /** Vertical centre as % of the video's height. */
  yPct: number
  /**
   * Horizontal centre as % of the video's width. Optional because clips
   * captioned before text could be dragged sideways carry no value, and both
   * the renderer and the editor read a missing one as the middle.
   */
  xPct?: number
  /**
   * The text column's width as % of the video's width — the box the editor
   * draws, which decides where lines break. Optional for the same reason as
   * xPct; a missing one means the full width a caption always had.
   */
  widthPct?: number
  outline: boolean
}

/**
 * How a moment is framed — decided once on the server, applied everywhere.
 * `focusPct` is what CSS object-position wants along the axis being cut;
 * `crop` is the exact window the export kept, normalised 0..1.
 */
export interface ClipComposition {
  aspectRatio: string
  mode: "smart_crop" | "blurred_background" | "padded" | "original"
  focalX: number | null
  focalY: number | null
  focusPct: number
  crop: { x: number; y: number; width: number; height: number } | null
}

export interface ClipMedia {
  composition: ClipComposition
  url: string | null
  canonicalUrl: string | null
  posterUrl: string | null
  posterTimestampSeconds: number | null
  sourceAspectRatio: string | null
  outputAspectRatio: string | null
  compositionMode: ClipComposition["mode"] | null
  derivativeStatus: "pending" | "ready" | "failed" | null
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
  /**
   * What to show and how it is framed. `media.url` is the 9:16 derivative for
   * a vertical moment (null until it is finished), `media.posterUrl` its still,
   * and `media.composition` the one framing the thumbnail, card, Preview and
   * export all derive from.
   */
  media?: ClipMedia
  /** The caption spec this render carries, so the editor starts from it. */
  captions?: ClipCaption[] | null
  derivedFromClipId?: string | null
  /** Only the person who cut a clip may replace it in place. */
  canReplace?: boolean
  /** The source video's true dimensions, when its probe knew them. */
  sourceWidth?: number | null
  sourceHeight?: number | null
  /**
   * Which file this moment delivers: its own framing ('original') or a 9:16
   * derivative ('vertical'). Older servers omit it.
   */
  presentation?: "original" | "vertical" | null
  /** Signed with an attachment disposition so the browser saves rather than plays. */
  downloadUrl: string | null
  urlExpiresAt: string | null
  /**
   * The boundaries the model originally predicted, frozen at generation.
   * start/end above are the live boundaries; when someone adjusts the clip
   * these keep saying where the model thought the moment was.
   */
  predictedStartSeconds?: number | null
  predictedEndSeconds?: number | null
  /** Set once someone has moved this clip's boundaries. */
  boundariesEditedAt?: string | null
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

/** A social account connected through Zernio, as the API mirrors it. */
export interface SocialAccount {
  id: string
  platform: "tiktok" | "youtube" | "instagram" | "x"
  displayName: string | null
  status: "connected" | "disconnected" | "reconnect_required"
}

/**
 * One publish of a clip as the API reads it back: on its way, up, or
 * refused. `status` is the provider's own word (or CLIPIT's 'submitting' /
 * 'rendering'); `outcome` is that word read for a person — "posted" only on
 * the platform's own word that it is up, never on the server having
 * accepted it.
 */
export interface ClipPost {
  id: string
  clipId: string | null
  status: string
  outcome: "posting" | "posted" | "failed"
  targets: Array<{ platform: string; accountId: string }>
  createdAt: string
}

/**
 * A publish promised for a chosen minute. Nothing has gone out while status
 * is 'waiting'; 'failed' carries the reason the promise could not be kept.
 */
export interface ScheduledPost {
  id: string
  clipId: string
  caption: string
  accountIds: string[]
  scheduledAt: string
  status: "waiting" | "firing" | "fired" | "failed" | "canceled"
  error: string | null
  /**
   * What the platforms actually did, read from the posts the fire created
   * — not from `status`, which only says the worker ran. Null while the
   * promise is still waiting. A schedule can be 'fired' with a shape still
   * being cut, and that cut can still fail.
   */
  outcome?: "posting" | "posted" | "partly_failed" | "failed" | null
  firedAt?: string | null
}

export interface SocialAccountsPage {
  /** False when the deployment has no Zernio configured — publishing is honestly absent. */
  configured: boolean
  /** True when the caller is a guest: accounts exist only for signed-in people. */
  signInRequired: boolean
  accounts: SocialAccount[]
}

/** A person in the caller's workspace. */
export interface TeamMember {
  userId: string
  email: string | null
  role: "owner" | "member"
  joinedAt: string
  isYou: boolean
}

/** An invitation that has been sent and not yet accepted. */
export interface TeamInvite {
  id: string
  email: string
  invitedAt: string
  expiresAt: string
}

/** One shared room a person belongs to, as the Workspaces list shows it. */
export interface WorkspaceSummary {
  id: string
  name: string
  isOwner: boolean
  /** True for the first workspace: the one where all your clips live. */
  isPersonal?: boolean
  /**
   * Whose room this is. A room you were invited to is theirs before it is
   * anything else, and the name they gave it does not say that on its own.
   */
  ownerEmail?: string | null
  memberCount: number
  clipCount: number
}

/** The rooms a person is in. */
export interface WorkspacesPage {
  /** True for a guest: a workspace belongs to a person, never to a tab. */
  signInRequired: boolean
  workspaces: WorkspaceSummary[]
  /** False when no email service is configured: links must be copied by hand. */
  emailConfigured?: boolean
}

/** One room: what is in it and who is in it. */
export interface WorkspaceDetail {
  /** True when the room holds more clips than one page shows. */
  hasMoreClips?: boolean
  workspace: { id: string; name: string; isOwner: boolean; isPersonal?: boolean }
  members: TeamMember[]
  clips: LibraryClip[]
  /** Only the owner sees pending invitations. */
  invites: TeamInvite[]
  emailConfigured?: boolean
}

/** What an invitation link is for, read without spending it. */
export interface InvitePreview {
  valid: boolean
  workspaceName: string | null
  email: string | null
}
