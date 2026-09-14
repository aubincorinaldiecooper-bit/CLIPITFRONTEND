import { vi } from "vitest"
import type { Exchange } from "../../components/start/types"
import { feedMoments, type FeedMoment } from "../../components/start/moments"
import type { ClipMatch, ClipRequest, Video } from "../../lib/types"

/** One moment of one question, the way the server tells it. */
export const match = (overrides: Partial<ClipMatch> = {}): ClipMatch =>
  ({
    id: "match-1",
    startSeconds: 10,
    endSeconds: 34,
    startTimecode: "0:10",
    endTimecode: "0:34",
    durationSeconds: 24,
    description: "Harbour skyline",
    confidence: 0.9,
    source: "visual",
    quote: null,
    thumbnailUrl: "https://cdn.test/still-1.jpg",
    feedback: null,
    feedbackReason: null,
    reclipStatus: null,
    reclipError: null,
    reclipCount: 0,
    reclipsRemaining: 2,
    clip: null,
    ...overrides,
  }) as ClipMatch

export const request = (overrides: Partial<ClipRequest> = {}): ClipRequest =>
  ({
    id: "req-1",
    videoId: "video-1",
    instruction: "find the harbour",
    mode: "auto",
    resolvedMode: "visual",
    status: "completed",
    error: null,
    answeredFrom: "notes",
    uncertain: [],
    progress: { stage: "done", percent: 100, chunksTotal: 1, chunksCompleted: 1, chunksFailed: 0, message: "" },
    failedChunks: [],
    coverage: { complete: true, locatable: true, unsearchedSeconds: 0, gaps: [], degraded: [] },
    matches: [match()],
    ...overrides,
  }) as ClipRequest

export const video = {
  id: "video-1",
  sourceType: "upload",
  sourceUrl: null,
  title: "harbour.mp4",
  originalFilename: "harbour.mp4",
  status: "ready",
  width: 1920,
  height: 1080,
  readyForSearch: true,
  acceptsQuestions: true,
  index: { status: "ready", readThroughSeconds: null },
  playback: { url: "https://cdn.test/source.mp4?sig=1", expiresAt: "", proxyUrl: "https://cdn.test/proxy.mp4?sig=1" },
} as unknown as Video

export const exchange = (overrides: Partial<ClipRequest> = {}, clips: Exchange["clips"] = []): Exchange => ({
  request: request(overrides),
  clips,
})

export const moments = (exchanges: Exchange[], forVideo: Video | null = video): FeedMoment[] => feedMoments(exchanges, forVideo)

/** A rating the server takes, and one it refuses. */
export const acceptingRate = () => vi.fn(async () => ({}))
export const refusingRate = () => vi.fn(async () => Promise.reject(new Error("no")))
