import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MomentFeed, feedCursor, feedMoments } from '../components/start/moment-feed'
import type { Exchange } from '../components/start/types'
import type { ClipMatch, ClipRequest, Video } from '../lib/types'

/**
 * The owner's feed of 2026-09-02, held by tests: one moment at a time;
 * moving on skips, moving back un-skips, ✓ keeps and keeps for good; ↻
 * reworks the same moment and holds the card while it does.
 */

const match = (overrides: Partial<ClipMatch> = {}): ClipMatch =>
  ({
    id: 'match-1',
    startSeconds: 10,
    endSeconds: 34,
    startTimecode: '0:10',
    endTimecode: '0:34',
    durationSeconds: 24,
    description: 'Harbour skyline',
    confidence: 0.9,
    source: 'visual',
    quote: null,
    thumbnailUrl: 'https://cdn.test/still-1.jpg',
    feedback: null,
    feedbackReason: null,
    reclipStatus: null,
    reclipError: null,
    reclipCount: 0,
    reclipsRemaining: 2,
    clip: null,
    ...overrides,
  }) as ClipMatch

const request = (id: string, matches: ClipMatch[]): ClipRequest =>
  ({
    id,
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
    matches,
  }) as ClipRequest

const video = { id: 'video-1', width: 1920, height: 1080, playback: null, readyForSearch: true } as unknown as Video

const exchange = (id: string, matches: ClipMatch[]): Exchange => ({ request: request(id, matches), clips: [] })

const handlers = () => ({
  onKeep: vi.fn(),
  onSkip: vi.fn(),
  onUndoSkip: vi.fn(),
  onReclip: vi.fn(),
  onUploadMore: vi.fn(),
})

// jsdom has no matchMedia; motion asks for it when it checks reduced-motion.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
})

afterEach(cleanup)

describe('feedMoments — every moment of every question, in order', () => {
  it('walks the questions in the order asked and the moments strongest first inside each', () => {
    const moments = feedMoments(
      [
        exchange('r1', [match({ id: 'a', confidence: 0.5 }), match({ id: 'b', confidence: 0.9 })]),
        exchange('r2', [match({ id: 'c', confidence: 0.99 })]),
      ],
      video,
    )
    expect(moments.map((moment) => moment.match.id)).toEqual(['b', 'a', 'c'])
    expect(moments.map((moment) => moment.requestId)).toEqual(['r1', 'r1', 'r2'])
  })

  it('keeps decided moments in the feed and puts the first undecided one on screen', () => {
    const moments = feedMoments(
      [exchange('r1', [match({ id: 'kept', confidence: 0.9, feedback: 'approved' }), match({ id: 'skipped', confidence: 0.8, feedback: 'rejected' }), match({ id: 'open', confidence: 0.7 })])],
      video,
    )
    expect(moments.map((moment) => moment.decision)).toEqual(['kept', 'skipped', null])
    expect(feedCursor(moments)).toBe(2)
  })

  it('points past the end once every moment is decided', () => {
    const moments = feedMoments([exchange('r1', [match({ feedback: 'rejected' })])], video)
    expect(feedCursor(moments)).toBe(1)
  })
})

describe('MomentFeed — one moment at a time', () => {
  it('shows the position in the feed and the moment on screen', () => {
    const moments = feedMoments([exchange('r1', [match({ id: 'a', confidence: 0.9 }), match({ id: 'b', confidence: 0.8 })])], video)
    render(<MomentFeed moments={moments} {...handlers()} />)
    expect(screen.getByTestId('feed-position').textContent).toContain('01')
    expect(screen.getByTestId('feed-total').textContent).toContain('02')
    expect(screen.getByTestId('feed-card').getAttribute('aria-label')).toBe('Harbour skyline')
  })

  it('✓ keeps the moment on screen, after the card has left', async () => {
    const moments = feedMoments([exchange('r1', [match({ id: 'a' })])], video)
    const h = handlers()
    render(<MomentFeed moments={moments} {...h} />)
    await userEvent.click(screen.getByRole('button', { name: /^Keep/ }))
    await waitFor(() => expect(h.onKeep).toHaveBeenCalledTimes(1))
    expect(h.onKeep.mock.calls[0]![0].match.id).toBe('a')
    expect(h.onSkip).not.toHaveBeenCalled()
  })

  it('✕ skips it; the keyboard does the same (→ keep, ← skip)', async () => {
    const moments = feedMoments([exchange('r1', [match({ id: 'a' })])], video)
    const h = handlers()
    render(<MomentFeed moments={moments} {...h} />)
    await userEvent.click(screen.getByRole('button', { name: /^Skip/ }))
    await waitFor(() => expect(h.onSkip).toHaveBeenCalledTimes(1))

    cleanup()
    const again = handlers()
    render(<MomentFeed moments={moments} {...again} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(again.onKeep).toHaveBeenCalledTimes(1))
  })

  it('scrolling back onto a skipped moment brings it back; a kept one is final', async () => {
    const skippedBefore = feedMoments(
      [exchange('r1', [match({ id: 'gone', confidence: 0.9, feedback: 'rejected' }), match({ id: 'open', confidence: 0.8 })])],
      video,
    )
    const h = handlers()
    render(<MomentFeed moments={skippedBefore} {...h} />)
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    await waitFor(() => expect(h.onUndoSkip).toHaveBeenCalledTimes(1))
    expect(h.onUndoSkip.mock.calls[0]![0].match.id).toBe('gone')

    cleanup()
    const keptBefore = feedMoments(
      [exchange('r1', [match({ id: 'saved', confidence: 0.9, feedback: 'approved' }), match({ id: 'open', confidence: 0.8 })])],
      video,
    )
    const k = handlers()
    render(<MomentFeed moments={keptBefore} {...k} />)
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(k.onUndoSkip).not.toHaveBeenCalled()
    expect(screen.getByText('Kept')).toBeTruthy()
  })

  it('a dot for a skipped moment brings it back; the other dots are not buttons', async () => {
    const moments = feedMoments(
      [exchange('r1', [match({ id: 'saved', confidence: 0.9, feedback: 'approved' }), match({ id: 'gone', confidence: 0.8, feedback: 'rejected' }), match({ id: 'open', confidence: 0.7 })])],
      video,
    )
    const h = handlers()
    render(<MomentFeed moments={moments} {...h} />)
    const dots = screen.getByTestId('feed-dots')
    expect(dots.querySelectorAll('button')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Bring back: Harbour skyline' }))
    expect(h.onUndoSkip).toHaveBeenCalledTimes(1)
    expect(h.onUndoSkip.mock.calls[0]![0].match.id).toBe('gone')
  })

  it('does not steal keys from someone typing', async () => {
    const moments = feedMoments([exchange('r1', [match({ id: 'a' })])], video)
    const h = handlers()
    render(
      <>
        <input aria-label="box" />
        <MomentFeed moments={moments} {...h} />
      </>,
    )
    fireEvent.keyDown(screen.getByLabelText('box'), { key: 'ArrowRight' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(h.onKeep).not.toHaveBeenCalled()
  })

  it('↻ reworks the same moment; while it does, the card is held and says so', async () => {
    const moments = feedMoments([exchange('r1', [match({ id: 'a' })])], video)
    const h = handlers()
    render(<MomentFeed moments={moments} {...h} />)
    await userEvent.click(screen.getByRole('button', { name: /Re-clip/ }))
    expect(h.onReclip).toHaveBeenCalledTimes(1)
    expect(h.onReclip.mock.calls[0]![0].match.id).toBe('a')

    cleanup()
    const reworking = feedMoments([exchange('r1', [match({ id: 'a', reclipStatus: 'pending' })])], video)
    const r = handlers()
    render(<MomentFeed moments={reworking} {...r} />)
    expect(screen.getByTestId('reworking-overlay').textContent).toContain('Reworking this edit')
    expect((screen.getByRole('button', { name: /^Keep/ }) as HTMLButtonElement | HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /^Skip/ }) as HTMLButtonElement | HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Re-clip/ }) as HTMLButtonElement | HTMLInputElement).disabled).toBe(true)
  })

  it('refuses ↻ once the allowance is spent, and says why', () => {
    const moments = feedMoments([exchange('r1', [match({ id: 'a', reclipsRemaining: 0 })])], video)
    render(<MomentFeed moments={moments} {...handlers()} />)
    const button = screen.getByRole('button', { name: /Re-clip/ })
    expect((button as HTMLButtonElement | HTMLInputElement).disabled).toBe(true)
    expect(button.getAttribute('title')).toBe('Re-clip limit reached for this moment')
  })

  it('ends with the honest fork once every moment is decided', () => {
    const moments = feedMoments([exchange('r1', [match({ id: 'a', feedback: 'approved' })])], video)
    const h = handlers()
    render(<MomentFeed moments={moments} {...h} />)
    expect(screen.getByTestId('feed-end').textContent).toContain("That's every moment")
    expect(screen.getByRole('link', { name: 'Go to your library' }).getAttribute('href')).toBe('/clips')
    expect(screen.queryByTestId('feed-controls')).toBeNull()
  })

  it('says so when there is nothing in the feed at all', async () => {
    const h = handlers()
    render(<MomentFeed moments={[]} {...h} />)
    expect(screen.getByTestId('feed-empty').textContent).toContain('No moments yet')
    await userEvent.click(screen.getByRole('button', { name: 'Upload more video' }))
    expect(h.onUploadMore).toHaveBeenCalled()
  })
})
