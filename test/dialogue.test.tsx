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
    expect(isEditRequest('redo this one')).toBe(true)
  })
  it('does not spend a re-cut on a search that happens to say "redo"', () => {
    // Codex's finding on #75: "redo" alone routed a search to Re-clip.
    expect(isEditRequest('find when they redo the kitchen')).toBe(false)
    expect(isEditRequest('redo')).toBe(false)
    expect(isEditRequest('show me where they rework the plan')).toBe(false)
    expect(isEditRequest('find where they rework the dough')).toBe(false)
    expect(isEditRequest('find this scene where they cut the cake')).toBe(false)
  })
})

describe('Dialogue', () => {
  it('opens on the empty state after a clean, complete first search: the first question was asked elsewhere, and the cards speak', () => {
    const exchanges: Exchange[] = [{ request: request({ matches: [match(), match({ id: 'm2' })] }), clips: [] }]
    render(<Dialogue exchanges={exchanges} video={video} moments={[moment()]} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getByTestId('dialogue-empty')).toBeTruthy()
    expect(screen.queryByTestId('dialogue-user')).toBeNull()
    expect(screen.queryByTestId('dialogue-model')).toBeNull()
  })

  it('opens on the empty state after a first search that found moments before the whole video was read: the reading is not narrated', () => {
    // The owner's run of 2026-09-02: the first answer opened with "4 so far
    // — I'm only 11 minutes in. Still watching the rest." The chat is a
    // conversation, not a report of what the reading is doing.
    const partial = request({
      matches: [match(), match({ id: 'm2' })],
      coverage: {
        complete: false, locatable: true, unsearchedSeconds: 240,
        gaps: [{ startSeconds: 361, endSeconds: 601, startTimecode: '6:01', endTimecode: '10:01', reason: 'not_read_yet' }],
        degraded: [],
      },
    } as Partial<ClipRequest>)
    const exchanges: Exchange[] = [{ request: partial, clips: [] }]
    render(<Dialogue exchanges={exchanges} video={video} moments={[moment()]} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getByTestId('dialogue-empty')).toBeTruthy()
    expect(screen.queryByTestId('dialogue-model')).toBeNull()
  })

  it('a follow-up asked here still admits the stretch not read yet, in words about how much was read', () => {
    const partial = request({
      id: 'r2', instruction: 'find the dunk',
      matches: [match({ id: 'm3' })],
      coverage: {
        complete: false, locatable: true, unsearchedSeconds: 240,
        gaps: [{ startSeconds: 361, endSeconds: 601, startTimecode: '6:01', endTimecode: '10:01', reason: 'not_read_yet' }],
        degraded: [],
      },
    } as Partial<ClipRequest>)
    const exchanges: Exchange[] = [{ request: request({ matches: [match()] }), clips: [] }, { request: partial, clips: [] }]
    const read = { ...video, index: { readThroughSeconds: 445 } } as unknown as Video
    render(<Dialogue exchanges={exchanges} video={read} moments={[moment()]} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getByTestId('dialogue-model').textContent).toContain("One so far — I've only read 7 minutes of it. Still watching the rest.")
  })

  it('still admits what the first search could not do: nothing found', () => {
    const exchanges: Exchange[] = [{ request: request({ matches: [] }), clips: [] }]
    render(<Dialogue exchanges={exchanges} video={video} moments={[]} active={undefined} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.queryByTestId('dialogue-empty')).toBeNull()
    expect(screen.getByTestId('dialogue-model').textContent).toContain("I couldn't find that")
  })

  it('shows a follow-up question and what the search said', () => {
    const exchanges: Exchange[] = [
      { request: request({ id: 'r0', instruction: 'the first ask', matches: [match({ id: 'm0' })] }), clips: [] },
      { request: request({ id: 'r1', matches: [match(), match({ id: 'm2' })] }), clips: [] },
    ]
    render(<Dialogue exchanges={exchanges} video={video} moments={[moment()]} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getAllByTestId('dialogue-user')).toHaveLength(1)
    expect(screen.getByTestId('dialogue-user').textContent).toContain('find the harbour')
    expect(screen.getByTestId('dialogue-model').textContent).toContain('Found 2 moments.')
  })

  it('keeps a minimum width, so it wraps below the feed instead of being squeezed', () => {
    // Beside the feed's fixed 440px, a 600px window leaves this column about
    // 112px. The minimum is what makes the row wrap and put the chat below
    // the feed; without it the messages and the box collapse into a strip.
    const { container } = render(
      <Dialogue exchanges={[]} video={video} moments={[]} active={undefined} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />,
    )
    expect((container.firstElementChild as HTMLElement).className).toMatch(/min-w-/)
  })

  it('keeps a question the server refused in the box, to edit and send again', async () => {
    const onAsk = vi.fn(async () => false)
    render(<Dialogue exchanges={[]} video={video} moments={[]} active={undefined} searching={false} onAsk={onAsk} onReclip={vi.fn()} />)
    const box = screen.getByRole('textbox', { name: 'Ask for a moment' })
    await userEvent.type(box, 'find the goal{enter}')
    expect(onAsk).toHaveBeenCalledWith('find the goal')
    // The box is Astryx's composer now, which is a rich contentEditable
    // rather than an <input>, so the words live in its text rather than a
    // `value`. What is being held to is unchanged: a refused question stays
    // put, and a taken one leaves.
    expect(box.textContent).toBe('find the goal')

    // And it can actually be sent again. Putting the words back on screen
    // without the composer knowing about them looks like a retry and is not
    // one: the send button stays dead and Enter submits nothing.
    onAsk.mockResolvedValueOnce(true as never)
    await userEvent.type(box, '{enter}')
    expect(onAsk).toHaveBeenCalledTimes(2)
    expect(onAsk).toHaveBeenLastCalledWith('find the goal')
    expect(box.textContent).toBe('')
  })

  it('says a re-cut did not start when the server refused it, instead of claiming it is underway', async () => {
    const onReclip = vi.fn(async () => false)
    render(<Dialogue exchanges={[]} video={video} moments={[moment()]} active={moment()} searching={false} onAsk={vi.fn()} onReclip={onReclip} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask for a moment' }), 're-cut it{enter}')
    expect(onReclip).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('dialogue-model').textContent).toContain('could not be re-cut just now')
    expect(screen.getByTestId('dialogue-model').textContent).not.toContain('Re-cutting')
  })

  it('says it is still looking while a search runs, and takes no second question', () => {
    const exchanges: Exchange[] = [{ request: request({ status: 'searching', progress: { stage: 'search', percent: 20, chunksTotal: 5, chunksCompleted: 2, chunksFailed: 0, message: 'Reading 1 of 5' } }), clips: [] }]
    render(<Dialogue exchanges={exchanges} video={video} moments={[]} active={undefined} searching onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getByTestId('dialogue-model').textContent).toContain('Looking through your video')
    // The backend's own progress string is no longer printed word for word
    // into the conversation. How far along it is lives in the activity row,
    // in words a person would use.
    expect(screen.getByTestId('dialogue-model').textContent).not.toContain('Reading 1 of 5')
    expect(document.body.textContent).toContain('2/5')
    // A contentEditable cannot be `disabled`; it is made uneditable instead,
    // which is how the composer refuses a second question mid-search.
    expect(screen.getByRole('textbox', { name: 'Ask for a moment' }).getAttribute('contenteditable')).toBe('false')
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
    render(<Dialogue exchanges={exchanges} video={video} moments={[moment()]} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    // The first search's one caveat, without its question and without the answer line the cards already give.
    expect(screen.getAllByTestId('dialogue-model')).toHaveLength(1)
    expect(screen.getByTestId('dialogue-model').textContent).toContain("I couldn't look at 1m 30s of this video (1:00–2:30)")
  })

  it('a new question is a search', async () => {
    const onAsk = vi.fn()
    render(<Dialogue exchanges={[]} video={video} moments={[]} active={undefined} searching={false} onAsk={onAsk} onReclip={vi.fn()} />)
    expect(screen.getByTestId('dialogue-empty')).toBeTruthy()
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask for a moment' }), 'find the part where the car pulls out{enter}')
    expect(onAsk).toHaveBeenCalledWith('find the part where the car pulls out')
  })

  it('words about the moment on screen go to Re-clip, and the reply does not pretend the words were followed', async () => {
    const onAsk = vi.fn()
    const onReclip = vi.fn()
    const active = moment()
    const reworking = moment({ match: match({ reclipStatus: 'pending' }), reworking: true })
    const { rerender } = render(<Dialogue exchanges={[]} video={video} moments={[reworking]} active={active} searching={false} onAsk={onAsk} onReclip={onReclip} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask for a moment' }), 'trim the slow intro off this one{enter}')
    expect(onReclip).toHaveBeenCalledWith(active)
    expect(onAsk).not.toHaveBeenCalled()
    expect(screen.getByTestId('dialogue-user').textContent).toContain('trim the slow intro off this one')
    expect(screen.getByTestId('dialogue-model').textContent).toContain("can't follow written edit instructions yet")

    // The note follows the moment: done, then (in another life) failed.
    rerender(<Dialogue exchanges={[]} video={video} moments={[moment()]} active={moment()} searching={false} onAsk={onAsk} onReclip={onReclip} />)
    expect(screen.getByTestId('dialogue-model').textContent).toContain("It's on the card now")
    rerender(<Dialogue exchanges={[]} video={video} moments={[moment({ match: match({ reclipStatus: 'failed', reclipError: 'The footage is gone.' }) })]} active={moment()} searching={false} onAsk={onAsk} onReclip={onReclip} />)
    expect(screen.getByTestId('dialogue-model').textContent).toContain("didn't work: The footage is gone.")
  })

  it('refuses a re-cut it cannot give, in words', async () => {
    const onReclip = vi.fn()
    render(<Dialogue exchanges={[]} video={video} moments={[]} active={moment({ match: match({ reclipsRemaining: 0 }) })} searching={false} onAsk={vi.fn()} onReclip={onReclip} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask for a moment' }), 're-cut it{enter}')
    expect(onReclip).not.toHaveBeenCalled()
    expect(screen.getByTestId('dialogue-model').textContent).toContain('has used all its re-cuts')
  })
})
