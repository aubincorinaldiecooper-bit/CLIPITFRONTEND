import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MomentFeed, feedCursor, feedMoments } from '../components/start/moment-feed'
import type { Exchange } from '../components/start/types'
import type { ClipMatch, ClipRequest, Video } from '../lib/types'

/**
 * The owner's feed of 2026-09-02 with the rules of 2026-09-05, held by
 * tests: one moment at a time; moving on skips, moving back un-skips; ✓
 * keeps — which makes the file — and the card stays on screen saying so,
 * still there to watch, download and publish; the front card plays exactly
 * the moment from the source, with a real clock; ↻ reworks the same moment
 * and holds the card while it does.
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

/**
 * Every clip is vertical. Never landscape. Ever. (Owner, 2026-09-03.)
 *
 * The card is a fixed 9:16 box, and it used to GUESS the source shape while
 * waiting for the server — so a wide video with no platform word in the
 * question drew a narrow band floating in black. It looked broken and nothing
 * had failed. The guess is 9:16 now, the same shape as the answer.
 */
describe('the card assumes vertical before the server has said anything', () => {
  it('is 9:16 for a moment with no clip and no platform word in the question', () => {
    // Needs a playback source: with none there is nothing to stand in for the
    // cut, and the card has no preview at all.
    const wide = {
      ...video,
      width: 1920,
      height: 1080,
      playback: { proxyUrl: 'https://cdn.test/videos/v1/playback.mp4?sig=1', url: null },
    } as never
    const [moment] = feedMoments(
      [{ request: request('r1', [match({ id: 'a' })]), clips: [] }],
      wide,
    )
    // Was "1920:1080" — the source shape — which the tall card letterboxed.
    expect(moment!.preview?.composition.aspectRatio).toBe('9:16')
  })

  it('still prefers what the server actually decided, when it has', () => {
    const [moment] = feedMoments(
      [cutExchange('r1', {}, verticalMedia('ready'))],
      video as never,
    )
    expect(moment!.preview?.composition.aspectRatio).toBe('9:16')
  })
})

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

  it('✓ keeps the moment on screen', async () => {
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

  it("every dot goes to its moment; a skipped moment's dot brings it back", async () => {
    const moments = feedMoments(
      [exchange('r1', [match({ id: 'saved', confidence: 0.9, feedback: 'approved' }), match({ id: 'gone', confidence: 0.8, feedback: 'rejected' }), match({ id: 'open', confidence: 0.7 })])],
      video,
    )
    const h = handlers()
    render(<MomentFeed moments={moments} {...h} />)
    const dots = screen.getByTestId('feed-dots')
    expect(dots.querySelectorAll('button')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Bring back: Harbour skyline' }))
    expect(h.onUndoSkip).toHaveBeenCalledTimes(1)
    expect(h.onUndoSkip.mock.calls[0]![0].match.id).toBe('gone')
    expect(screen.getByTestId('feed-position').textContent).toContain('02')
    // A kept moment's dot just goes there: it stays kept, and its card says so.
    await userEvent.click(screen.getAllByRole('button', { name: 'Go to: Harbour skyline' })[0]!)
    expect(screen.getByTestId('feed-position').textContent).toContain('01')
    expect(screen.getByTestId('feed-decision').textContent).toContain('Kept')
    expect(h.onUndoSkip).toHaveBeenCalledTimes(1)
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

  it('a keep leaves the card on screen, saying its file is being made; onward is the next card, and a skip there is its own decision', async () => {
    // Keep is production (owner, 2026-09-05): the cut starts from the
    // press, and the moment stays where it is — to be watched, then
    // downloaded or published — rather than leaving the screen.
    // Devin's finding on #75 still holds: the cooldown that tames a held
    // key or a wheel flick must not swallow a deliberate second press.
    const h = handlers()
    const before = feedMoments([exchange('r1', [match({ id: 'a', confidence: 0.9 }), match({ id: 'b', confidence: 0.8 })])], video)
    const { rerender } = render(<MomentFeed moments={before} {...h} />)
    await userEvent.click(screen.getByRole('button', { name: /^Keep/ }))
    expect(h.onKeep).toHaveBeenCalledTimes(1)
    // The server records the keep and starts the cut; the card stays.
    const after = feedMoments(
      [
        {
          request: request('r1', [match({ id: 'a', confidence: 0.9, feedback: 'approved', clip: { id: 'c-a', status: 'pending' } }), match({ id: 'b', confidence: 0.8 })]),
          clips: [{ id: 'c-a', clipMatchId: 'a', status: 'pending', url: null, media: null } as never],
        },
      ],
      video,
    )
    rerender(<MomentFeed moments={after} {...h} />)
    expect(screen.getByTestId('feed-position').textContent).toContain('01')
    expect(screen.getByTestId('feed-decision').textContent).toContain('Kept · cutting')
    expect((screen.getByRole('button', { name: 'Kept' }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Next moment' }))
    expect(h.onSkip).not.toHaveBeenCalled()
    expect(screen.getByTestId('feed-position').textContent).toContain('02')
    await userEvent.click(screen.getByRole('button', { name: /^Skip/ }))
    expect(h.onSkip).toHaveBeenCalledTimes(1)
    expect(h.onSkip.mock.calls[0]![0].match.id).toBe('b')
  })

  it('a kept moment whose cut failed can be kept again', async () => {
    // Devin's and Codex's finding on #87: the copy promised a retry and no control gave one.
    const failed = feedMoments([cutExchange('r1', { feedback: 'approved' }, verticalMedia('failed'))], video)
    const h = handlers()
    render(<MomentFeed moments={failed} {...h} />)
    await userEvent.click(screen.getByRole('button', { name: 'Look back over them' }))
    const again = screen.getByRole('button', { name: /^Keep again/ })
    expect((again as HTMLButtonElement).disabled).toBe(false)
    await userEvent.click(again)
    expect(h.onKeep).toHaveBeenCalledTimes(1)
    expect(h.onKeep.mock.calls[0]![0].match.id).toBe('a')
  })

  it('shows a clip made on Keep before the moment has been re-read with its id', () => {
    // Devin's finding on #87: the row names the moment; that is enough.
    const early: Exchange = {
      request: request('r1', [match({ id: 'a' })]),
      clips: [{ id: 'c-a', clipMatchId: 'a', status: 'ready', url: 'https://cdn.test/clips/v/c-a.mp4?sig=1', media: { ...verticalMedia('ready'), downloadUrl: 'https://cdn.test/clips/v/c-a-vertical.mp4?download=1' } } as never],
    }
    const [moment] = feedMoments([early], video)
    expect(moment!.production).toBe('produced')
    expect(moment!.downloadUrl).toBe('https://cdn.test/clips/v/c-a-vertical.mp4?download=1')
    render(<MomentFeed moments={feedMoments([early], video)} {...handlers()} />)
    expect(screen.getByTestId('feed-download')).toBeTruthy()
  })

  it('keeps the same moment in front when a stronger one lands above it', async () => {
    // Devin's and Codex's finding on #87: the front card was a number, and a
    // poll that re-sorted the feed put another moment under it.
    const h = handlers()
    const before = feedMoments([exchange('r1', [match({ id: 'a', confidence: 0.9 }), match({ id: 'b', confidence: 0.8, description: 'The dunk' })])], video)
    const { rerender } = render(<MomentFeed moments={before} {...h} />)
    await userEvent.click(screen.getByRole('button', { name: /^Skip/ }))
    expect(screen.getByTestId('feed-card').getAttribute('aria-label')).toBe('The dunk')
    const after = feedMoments(
      [exchange('r1', [match({ id: 'c', confidence: 0.95, description: 'The stronger one' }), match({ id: 'a', confidence: 0.9, feedback: 'rejected' }), match({ id: 'b', confidence: 0.8, description: 'The dunk' })])],
      video,
    )
    rerender(<MomentFeed moments={after} {...h} />)
    expect(screen.getByTestId('feed-card').getAttribute('aria-label')).toBe('The dunk')
    expect(screen.getByTestId('feed-position').textContent).toContain('03')
  })

  it('moments that land while the person sits on the end card come to the front', () => {
    const h = handlers()
    const { rerender } = render(<MomentFeed moments={feedMoments([exchange('r1', [match({ id: 'a', feedback: 'approved' })])], video)} {...h} />)
    expect(screen.queryByTestId('feed-controls')).toBeNull()
    rerender(<MomentFeed moments={feedMoments([exchange('r1', [match({ id: 'a', feedback: 'approved' })]), exchange('r2', [match({ id: 'b', description: 'The dunk' })])], video)} {...h} />)
    expect(screen.getByTestId('feed-position').textContent).toContain('02')
    expect(screen.getByTestId('feed-card').getAttribute('aria-label')).toBe('The dunk')
  })

  it('while the first search runs, says where the moments will land instead of "No moments yet"', () => {
    render(<MomentFeed moments={[]} searching {...handlers()} />)
    expect(screen.getByTestId('feed-searching').textContent).toContain('Moments land here')
    expect(screen.queryByTestId('feed-empty')).toBeNull()
  })

  it('plays exactly the moment from the source, with play/pause in the middle and the time within the moment', () => {
    // The owner's session of 2026-09-05: the card showed "1:38" over a
    // moment at 1:38–1:51 of the video, and nothing to press. The clock is
    // the moment's own, and every number on it comes from the element.
    const withPlayback = { ...video, playback: { url: 'https://cdn.test/source.mp4', expiresAt: '' } } as unknown as Video
    render(<MomentFeed moments={feedMoments([exchange('r1', [match({ id: 'a', startSeconds: 98, endSeconds: 111.2 })])], withPlayback)} {...handlers()} />)
    const element = screen.getByTestId('feed-video') as HTMLVideoElement
    expect(element.getAttribute('src')).toContain('#t=98')
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
    expect(screen.getByTestId('feed-time').textContent).toBe('0:00 / 0:13')

    // jsdom plays nothing; what the element reports is what is shown.
    Object.defineProperty(element, 'paused', { value: false, configurable: true })
    element.currentTime = 102
    fireEvent.play(element)
    fireEvent.timeUpdate(element)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
    expect(screen.getByTestId('feed-time').textContent).toBe('0:04 / 0:13')

    element.currentTime = 108.5
    fireEvent.seeked(element)
    expect(screen.getByTestId('feed-time').textContent).toBe('0:10 / 0:13')

    // Past the moment's end it plays the moment again — never the rest of the video.
    element.currentTime = 111.5
    fireEvent.timeUpdate(element)
    expect(element.currentTime).toBe(98)

    Object.defineProperty(element, 'paused', { value: true, configurable: true })
    fireEvent.pause(element)
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
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

  it('publish can be pressed before any file exists: it keeps the moment, and the publish screens wait for the file', async () => {
    const moments = feedMoments([exchange('r1', [match({ id: 'a' })])], video)
    const h = handlers()
    render(<MomentFeed moments={moments} {...h} />)
    const button = screen.getByRole('button', { name: /^Publish/ })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(button.getAttribute('title')).toContain('keep this moment')
    await userEvent.click(button)
    expect(h.onPublish).toHaveBeenCalledTimes(1)
    // Nothing to download: there is no file yet.
    expect(screen.queryByTestId('feed-download')).toBeNull()
  })

  it('the corner offers Download only once the 9:16 file exists — never the landscape cut in its place', async () => {
    // Devin's finding on #76 still holds: the landscape cut is ready long
    // before the vertical one, and it is not what the person is saving.
    const withPlayback = { ...video, playback: { url: 'https://cdn.test/source.mp4', expiresAt: '' } } as unknown as Video
    const pending = feedMoments([cutExchange('r1', { feedback: 'approved' }, { ...verticalMedia('pending'), downloadUrl: null })], withPlayback)
    const { rerender } = render(<MomentFeed moments={pending} {...handlers()} />)
    // Every moment is decided, so the feed opens on the end card — which
    // says the moments are still here, and takes you back to them.
    expect(screen.getByTestId('feed-end').textContent).toContain('still here')
    await userEvent.click(screen.getByRole('button', { name: 'Look back over them' }))
    expect(screen.getByTestId('feed-position').textContent).toContain('01')
    expect(screen.queryByTestId('feed-download')).toBeNull()
    expect(screen.getByTestId('feed-decision').textContent).toContain('cutting')
    expect(screen.getByRole('button', { name: /^Publish/ }).getAttribute('title')).toContain('once the cut is ready')
    // The source stands in for the file meanwhile.
    expect((screen.getByTestId('feed-video') as HTMLVideoElement).getAttribute('src')).toContain('source.mp4')

    rerender(<MomentFeed moments={feedMoments([cutExchange('r1', { feedback: 'approved' }, { ...verticalMedia('failed'), downloadUrl: null })], video)} {...handlers()} />)
    expect(screen.queryByTestId('feed-download')).toBeNull()
    expect(screen.getByTestId('feed-decision').textContent).toContain('cut failed')
    const publish = screen.getByRole('button', { name: /^Publish/ })
    expect((publish as HTMLButtonElement).disabled).toBe(false)
    expect(publish.getAttribute('title')).toContain('makes it again')

    rerender(<MomentFeed moments={feedMoments([cutExchange('r1', { feedback: 'approved' }, { ...verticalMedia('ready'), downloadUrl: 'https://cdn.test/clips/v/c-a-vertical.mp4?download=1' })], video)} {...handlers()} />)
    expect(screen.getByTestId('feed-download').getAttribute('href')).toBe('https://cdn.test/clips/v/c-a-vertical.mp4?download=1')
    expect(screen.getByTestId('feed-decision').textContent).toBe('Kept')
    expect((screen.getByTestId('feed-video') as HTMLVideoElement).getAttribute('src')).toContain('c-a-vertical.mp4')

    // A server that signs nothing for saving offers nothing — not the landscape file.
    rerender(<MomentFeed moments={feedMoments([cutExchange('r1', { feedback: 'approved' }, verticalMedia('ready'))], video)} {...handlers()} />)
    expect(screen.queryByTestId('feed-download')).toBeNull()
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
