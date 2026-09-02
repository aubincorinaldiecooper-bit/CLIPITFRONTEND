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
  onPublish: vi.fn(),
  onUploadMore: vi.fn(),
})

/** An exchange whose one moment has a finished cut to play and to send. */
const cutExchange = (id: string, overrides: Partial<ClipMatch> = {}, media: unknown = null): Exchange => ({
  request: request(id, [match({ id: 'a', clip: { id: 'c-a', status: 'ready' }, ...overrides })]),
  clips: [{ id: 'c-a', clipMatchId: 'a', status: 'ready', url: 'https://cdn.test/clips/v/c-a.mp4?sig=1', media } as never],
})

/** A vertical moment's media: the 9:16 derivative in the state given, the landscape cut beside it. */
const verticalMedia = (derivativeStatus: 'pending' | 'ready' | 'failed') => ({
  composition: { aspectRatio: '9:16', mode: 'smart_crop', focalX: 0.5, focalY: 0.5, focusPct: 50, crop: null },
  url: derivativeStatus === 'ready' ? 'https://cdn.test/clips/v/c-a-vertical.mp4?sig=1' : null,
  canonicalUrl: 'https://cdn.test/clips/v/c-a.mp4?sig=1',
  posterUrl: 'https://cdn.test/posters/c-a.jpg',
  posterTimestampSeconds: 1,
  sourceAspectRatio: '16:9',
  outputAspectRatio: '9:16',
  compositionMode: 'smart_crop',
  derivativeStatus,
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

  it('keeps playing the link it started with while the page re-signs it, and takes the new one only when the old fails', () => {
    // Devin's finding on #75: the page polls while a video is still being
    // read, every poll re-signs the URLs, and a src bound to the newest
    // one reloaded the player every two seconds.
    const withPlayback = { ...video, playback: { url: 'https://cdn.test/source?sig=1', expiresAt: '' } } as unknown as Video
    const { rerender } = render(<MomentFeed moments={feedMoments([exchange('r1', [match({ id: 'a' })])], withPlayback)} {...handlers()} />)
    const before = (screen.getByTestId('feed-video') as HTMLVideoElement).getAttribute('src')
    expect(before).toContain('sig=1')

    const resigned = { ...withPlayback, playback: { url: 'https://cdn.test/source?sig=2', expiresAt: '' } } as unknown as Video
    rerender(<MomentFeed moments={feedMoments([exchange('r1', [match({ id: 'a' })])], resigned)} {...handlers()} />)
    expect((screen.getByTestId('feed-video') as HTMLVideoElement).getAttribute('src')).toBe(before)

    fireEvent.error(screen.getByTestId('feed-video'))
    expect((screen.getByTestId('feed-video') as HTMLVideoElement).getAttribute('src')).toContain('sig=2')
  })

  it('plays a re-cut\'s new file at once, while still ignoring a re-signed link to the same file', () => {
    // Devin's finding on #75: a re-cut writes a NEW file; the card kept the old one until it failed.
    const ready = (url: string) => ({
      request: {
        ...exchange('r1', [match({ id: 'a', clip: { id: 'c-a', status: 'ready' } })]).request,
      },
      clips: [{ id: 'c-a', clipMatchId: 'a', status: 'ready', url, media: null } as never],
    }) as unknown as Exchange
    const { rerender } = render(<MomentFeed moments={feedMoments([ready('https://cdn.test/clips/v/c-a.mp4?sig=1')], video)} {...handlers()} />)
    const first = (screen.getByTestId('feed-video') as HTMLVideoElement).getAttribute('src')
    expect(first).toContain('c-a.mp4?sig=1')

    rerender(<MomentFeed moments={feedMoments([ready('https://cdn.test/clips/v/c-a.mp4?sig=2')], video)} {...handlers()} />)
    expect((screen.getByTestId('feed-video') as HTMLVideoElement).getAttribute('src')).toBe(first)

    rerender(<MomentFeed moments={feedMoments([ready('https://cdn.test/clips/v/c-a-9f3c.mp4?sig=3')], video)} {...handlers()} />)
    expect((screen.getByTestId('feed-video') as HTMLVideoElement).getAttribute('src')).toContain('c-a-9f3c.mp4?sig=3')
  })

  it('a held key is one press, and two quick presses are one keep', async () => {
    // Codex's finding on #75: key repeat could keep several moments before
    // the person let go, and a keep is final.
    const moments = feedMoments([exchange('r1', [match({ id: 'a', confidence: 0.9 }), match({ id: 'b', confidence: 0.8 })])], video)
    const h = handlers()
    render(<MomentFeed moments={moments} {...h} />)
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })
    expect(h.onKeep).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(h.onKeep).toHaveBeenCalledTimes(1)
  })

  it('two quick presses of the buttons are two decisions: a keep, then a skip on the next card', async () => {
    // Devin's finding on #75: the cooldown that tames a held key or a
    // wheel flick must not swallow a deliberate second press.
    const h = handlers()
    const before = feedMoments([exchange('r1', [match({ id: 'a', confidence: 0.9 }), match({ id: 'b', confidence: 0.8 })])], video)
    const { rerender } = render(<MomentFeed moments={before} {...h} />)
    await userEvent.click(screen.getByRole('button', { name: /^Keep/ }))
    expect(h.onKeep).toHaveBeenCalledTimes(1)
    const after = feedMoments([exchange('r1', [match({ id: 'a', confidence: 0.9, feedback: 'approved' }), match({ id: 'b', confidence: 0.8 })])], video)
    rerender(<MomentFeed moments={after} {...h} />)
    await userEvent.click(screen.getByRole('button', { name: /^Skip/ }))
    expect(h.onSkip).toHaveBeenCalledTimes(1)
    expect(h.onSkip.mock.calls[0]![0].match.id).toBe('b')
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

  it('the corner control publishes the moment on screen — the owner\'s call, in place of the re-cut', async () => {
    const moments = feedMoments([cutExchange('r1')], video)
    const h = handlers()
    render(<MomentFeed moments={moments} {...h} />)
    expect(screen.queryByRole('button', { name: /Re-clip/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^Publish/ }))
    expect(h.onPublish).toHaveBeenCalledTimes(1)
    expect(h.onPublish.mock.calls[0]![0].match.id).toBe('a')
  })

  it('a moment still being cut cannot be published yet, and says so', () => {
    const moments = feedMoments([exchange('r1', [match({ id: 'a' })])], video)
    render(<MomentFeed moments={moments} {...handlers()} />)
    const button = screen.getByRole('button', { name: /^Publish/ })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('title')).toContain('Still cutting')
  })

  it('a vertical moment goes out only once its 9:16 file exists — never the landscape cut in its place', () => {
    // Devin's finding on #76: the landscape cut is ready long before the
    // vertical one, and it is not what the person is sending.
    const pending = feedMoments([cutExchange('r1', {}, verticalMedia('pending'))], { ...video, playback: { url: 'https://cdn.test/source.mp4', expiresAt: '' } } as unknown as Video)
    const { rerender } = render(<MomentFeed moments={pending} {...handlers()} />)
    let button = screen.getByRole('button', { name: /^Publish/ })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('title')).toContain('Still cutting')

    rerender(<MomentFeed moments={feedMoments([cutExchange('r1', {}, verticalMedia('failed'))], video)} {...handlers()} />)
    button = screen.getByRole('button', { name: /^Publish/ })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('title')).toContain('cut failed')

    rerender(<MomentFeed moments={feedMoments([cutExchange('r1', {}, verticalMedia('ready'))], video)} {...handlers()} />)
    button = screen.getByRole('button', { name: /^Publish/ })
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })

  it('decides nothing while the publish dialog has the screen, and ignores keys pressed inside a dialog', async () => {
    // Devin's finding on #76: the feed's shortcuts kept working behind the dialog.
    const moments = feedMoments([cutExchange('r1')], video)
    const h = handlers()
    const { rerender } = render(<MomentFeed moments={moments} {...h} paused />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(h.onKeep).not.toHaveBeenCalled()
    expect(h.onSkip).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: /^Keep/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /^Publish/ }) as HTMLButtonElement).disabled).toBe(true)

    rerender(
      <>
        <div role="dialog"><button type="button">Post now</button></div>
        <MomentFeed moments={moments} {...h} />
      </>,
    )
    fireEvent.keyDown(screen.getByRole('button', { name: 'Post now' }), { key: 'ArrowRight' })
    expect(h.onKeep).not.toHaveBeenCalled()
  })

  it('while the system reworks the moment, the card is held and says so', () => {
    const reworking = feedMoments([cutExchange('r1', { reclipStatus: 'pending' })], video)
    render(<MomentFeed moments={reworking} {...handlers()} />)
    expect(screen.getByTestId('reworking-overlay').textContent).toContain('Reworking this edit')
    expect((screen.getByRole('button', { name: /^Keep/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /^Skip/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /^Publish/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('ends with the honest fork once every moment is decided', () => {
    const moments = feedMoments([exchange('r1', [match({ id: 'a', feedback: 'approved' })])], video)
    const h = handlers()
    render(<MomentFeed moments={moments} {...h} />)
    expect(screen.getByTestId('feed-end').textContent).toContain("That's every moment")
    // The library is hidden for now (owner, 2026-09-02): the only way on is more video.
    expect(screen.getByRole('button', { name: 'Upload more video' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Go to your library' })).toBeNull()
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
