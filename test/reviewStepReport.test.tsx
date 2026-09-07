import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { ReviewStep } from '../components/start/review-step'
import type { Exchange } from '../components/start/types'
import type { ClipMatch, ClipRequest, Video } from '../lib/types'

/**
 * A report made from the review screen is about the question that owns
 * the moment in front — not the newest question (Devin's finding on #88).
 */
const match = (overrides: Partial<ClipMatch> = {}): ClipMatch =>
  ({ id: 'm1', startSeconds: 10, endSeconds: 34, startTimecode: '0:10', endTimecode: '0:34', durationSeconds: 24, description: 'Harbour skyline', confidence: 0.9, source: 'visual', quote: null, thumbnailUrl: null, feedback: null, feedbackReason: null, reclipStatus: null, reclipError: null, reclipCount: 0, reclipsRemaining: 2, clip: null, ...overrides }) as ClipMatch

const request = (id: string, matches: ClipMatch[]): ClipRequest =>
  ({ id, videoId: 'video-1', instruction: 'find the harbour', mode: 'auto', resolvedMode: 'visual', status: 'completed', error: null, answeredFrom: 'notes', uncertain: [], progress: { stage: 'done', percent: 100, chunksTotal: 1, chunksCompleted: 1, chunksFailed: 0, message: '' }, failedChunks: [], coverage: { complete: true, locatable: true, unsearchedSeconds: 0, gaps: [], degraded: [] }, matches }) as ClipRequest

const video = { id: 'video-1', width: 1920, height: 1080, playback: null, readyForSearch: true, acceptsQuestions: true, index: { readThroughSeconds: null } } as unknown as Video

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
})

afterEach(cleanup)

describe('ReviewStep — the moment in front', () => {
  it('reports the question that owns the moment in front, and nothing once it has gone', async () => {
    const exchanges: Exchange[] = [
      { request: request('r1', [match({ id: 'a' })]), clips: [] },
      { request: request('r2', [match({ id: 'b', description: 'The dunk' })]), clips: [] },
    ]
    const onFrontMomentChange = vi.fn()
    const handlers = { onKeep: vi.fn(), onSkip: vi.fn(), onUndoSkip: vi.fn(), onReclip: vi.fn(), onAsk: vi.fn(), onPublish: vi.fn(), onUploadMore: vi.fn() }
    const { unmount } = render(<ReviewStep exchanges={exchanges} video={video} searching={false} onFrontMomentChange={onFrontMomentChange} {...handlers} />)
    await waitFor(() => expect(onFrontMomentChange).toHaveBeenCalled())
    const last = onFrontMomentChange.mock.calls.at(-1)![0]
    expect(last?.requestId).toBe('r1')
    unmount()
    expect(onFrontMomentChange.mock.calls.at(-1)![0]).toBeUndefined()
  })
})
