import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialogue, isEditRequest } from '../components/start/dialogue'
import type { FeedMoment } from '../components/start/moment-feed'
import type { Exchange } from '../components/start/types'
import type { ClipMatch, ClipRequest, Video } from '../lib/types'

/**
 * The dialogue beside the feed: every question and what came of it; a new
 * question is a search; words about the moment on screen go to Re-clip —
 * and the reply never pretends the words themselves were followed.
 */

const request = (overrides: Partial<ClipRequest>): ClipRequest =>
  ({
    id: 'r1',
    videoId: 'video-1',
    instruction: 'find the harbour',
    mode: 'auto',
    resolvedMode: 'visual',
    status: 'completed',
    error: null,
    answeredFrom: 'notes',
    uncertain: [],
    progress: { stage: 'done', percent: 100, chunksTotal: 1, chunksCompleted: 1, chunksFailed: 0, message: '' },
    failedChunks: [],
    coverage: { complete: true, locatable: true, unsearchedSeconds: 0, gaps: [], degraded: [] },
    matches: [],
    ...overrides,
  }) as ClipRequest

const match = (overrides: Partial<ClipMatch> = {}): ClipMatch =>
  ({ id: 'm1', description: 'Harbour skyline', confidence: 0.9, feedback: null, reclipStatus: null, reclipsRemaining: 2, ...overrides }) as ClipMatch

const moment = (overrides: Partial<FeedMoment> = {}): FeedMoment => ({
  requestId: 'r1',
  match: match(),
  clip: null,
  still: null,
  preview: null,
  decision: null,
  reworking: false,
  ...overrides,
})

const video = { id: 'video-1', readyForSearch: true, index: { readThroughSeconds: null } } as unknown as Video

afterEach(cleanup)

describe('isEditRequest — words about the moment on screen', () => {
  it('reads a search as a search, even one that says "cut"', () => {
    expect(isEditRequest('cut every time the crowd cheers')).toBe(false)
    expect(isEditRequest('find the part where the car pulls out')).toBe(false)
  })
  it('reads words pointed at the clip as an edit', () => {
    expect(isEditRequest('tighten this one')).toBe(true)
    expect(isEditRequest('trim the slow intro off this one')).toBe(true)
    expect(isEditRequest('re-cut it')).toBe(true)
    expect(isEditRequest('reclip')).toBe(true)
  })
})

describe('Dialogue', () => {
  it('shows each question and what the search said', () => {
    const exchanges: Exchange[] = [{ request: request({ matches: [match(), match({ id: 'm2' })] }), clips: [] }]
    render(<Dialogue exchanges={exchanges} video={video} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getByTestId('dialogue-user').textContent).toContain('find the harbour')
    expect(screen.getByTestId('dialogue-model').textContent).toContain('Found 2 moments.')
  })

  it('says it is still looking while a search runs, and takes no second question', () => {
    const exchanges: Exchange[] = [{ request: request({ status: 'searching', progress: { stage: 'search', percent: 20, chunksTotal: 5, chunksCompleted: 1, chunksFailed: 0, message: 'Reading 1 of 5' } }), clips: [] }]
    render(<Dialogue exchanges={exchanges} video={video} active={undefined} searching onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getByTestId('dialogue-model').textContent).toContain('Looking through your video')
    expect(screen.getByTestId('dialogue-model').textContent).toContain('Reading 1 of 5')
    expect((screen.getByRole('textbox', { name: 'Ask for a moment' }) as HTMLButtonElement | HTMLInputElement).disabled).toBe(true)
  })

  it('names a stretch it could not look at', () => {
    const exchanges: Exchange[] = [
      {
        request: request({
          matches: [match()],
          coverage: { complete: false, locatable: true, unsearchedSeconds: 90, gaps: [{ startSeconds: 60, endSeconds: 150, startTimecode: '1:00', endTimecode: '2:30', reason: 'provider_refused' }], degraded: [] },
        }),
        clips: [],
      },
    ]
    render(<Dialogue exchanges={exchanges} video={video} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getAllByTestId('dialogue-model')[1].textContent).toContain("I couldn't look at 1m 30s of this video (1:00–2:30)")
  })

  it('a new question is a search', async () => {
    const onAsk = vi.fn()
    render(<Dialogue exchanges={[]} video={video} active={undefined} searching={false} onAsk={onAsk} onReclip={vi.fn()} />)
    expect(screen.getByTestId('dialogue-empty')).toBeTruthy()
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask for a moment' }), 'find the part where the car pulls out{enter}')
    expect(onAsk).toHaveBeenCalledWith('find the part where the car pulls out')
  })

  it('words about the moment on screen go to Re-clip, and the reply does not pretend the words were followed', async () => {
    const onAsk = vi.fn()
    const onReclip = vi.fn()
    const active = moment()
    render(<Dialogue exchanges={[]} video={video} active={active} searching={false} onAsk={onAsk} onReclip={onReclip} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask for a moment' }), 'trim the slow intro off this one{enter}')
    expect(onReclip).toHaveBeenCalledWith(active)
    expect(onAsk).not.toHaveBeenCalled()
    expect(screen.getByTestId('dialogue-user').textContent).toContain('trim the slow intro off this one')
    expect(screen.getByTestId('dialogue-model').textContent).toContain("can't follow written edit instructions yet")
  })

  it('refuses a re-cut it cannot give, in words', async () => {
    const onReclip = vi.fn()
    render(<Dialogue exchanges={[]} video={video} active={moment({ match: match({ reclipsRemaining: 0 }) })} searching={false} onAsk={vi.fn()} onReclip={onReclip} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask for a moment' }), 're-cut it{enter}')
    expect(onReclip).not.toHaveBeenCalled()
    expect(screen.getByTestId('dialogue-model').textContent).toContain('has used all its re-cuts')
  })
})
