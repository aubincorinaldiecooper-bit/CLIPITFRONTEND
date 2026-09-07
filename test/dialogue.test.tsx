import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
  production: null,
  downloadUrl: null,
  reworking: false,
  ...overrides,
})

/** Every line the system has said, in order. */
const said = () => screen.getAllByTestId('dialogue-model').map((line) => line.textContent)

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
  it('the first question is in the conversation: asked, acknowledged, and answered with the count it finished with', () => {
    // The owner's call of 2026-09-05: the first question used to be asked
    // on the upload step and answered by the cards alone, and the chat
    // opened empty. It is a conversation from the first word now.
    const exchanges: Exchange[] = [{ request: request({ matches: [match(), match({ id: 'm2' })] }), clips: [] }]
    render(<Dialogue exchanges={exchanges} video={video} moments={[moment()]} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.queryByTestId('dialogue-empty')).toBeNull()
    expect(screen.getByTestId('dialogue-user').textContent).toBe('find the harbour')
    expect(said()[0]).toBe("I'll look for that.")
    expect(said()).toContain('Found 2 moments.')
  })

  it('a first answer given before the whole video was read says so, in words about how much was read', () => {
    const partial = request({
      matches: [match(), match({ id: 'm2' })],
      coverage: {
        complete: false, locatable: true, unsearchedSeconds: 240,
        gaps: [{ startSeconds: 361, endSeconds: 601, startTimecode: '6:01', endTimecode: '10:01', reason: 'not_read_yet' }],
        degraded: [],
      },
    } as Partial<ClipRequest>)
    const read = { ...video, index: { readThroughSeconds: 445 } } as unknown as Video
    render(<Dialogue exchanges={[{ request: partial, clips: [] }]} video={read} moments={[moment()]} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(said()).toContain("2 so far — I've only read 7 minutes of it. Still watching the rest.")
  })

  it('a question that asks for every appearance is acknowledged as one', () => {
    const exchanges: Exchange[] = [{ request: request({ instruction: 'every time the crowd cheers', status: 'searching' }), clips: [] }]
    render(<Dialogue exchanges={exchanges} video={video} moments={[]} active={undefined} searching onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(said()[0]).toBe("I'll look for every one of those.")
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
    expect(said()).toContain("One so far — I've only read 7 minutes of it. Still watching the rest.")
  })

  it('nothing found is a real answer, said as one', () => {
    const exchanges: Exchange[] = [{ request: request({ matches: [] }), clips: [] }]
    render(<Dialogue exchanges={exchanges} video={video} moments={[]} active={undefined} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.queryByTestId('dialogue-empty')).toBeNull()
    expect(said()).toContain("I couldn't find a clear moment where that happens. Try describing it another way.")
  })

  it('shows every question and what each search said, a follow-up in follow-up words', () => {
    const exchanges: Exchange[] = [
      { request: request({ id: 'r0', instruction: 'the first ask', matches: [match({ id: 'm0' })] }), clips: [] },
      { request: request({ id: 'r1', matches: [match(), match({ id: 'm2' })] }), clips: [] },
    ]
    render(<Dialogue exchanges={exchanges} video={video} moments={[moment()]} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getAllByTestId('dialogue-user').map((line) => line.textContent)).toEqual(['the first ask', 'find the harbour'])
    expect(said()).toContain("I'll look for that too.")
    expect(said()).toContain('Found 2 moments for that too.')
  })

  it('says how many were held back by a number the person wrote', () => {
    const exchanges: Exchange[] = [
      { request: request({ instruction: 'give me 2', matches: [match(), match({ id: 'm2' })], deck: { requestedResultCount: 2, availableCandidateCount: 5, effectiveDeckTarget: 2 } } as Partial<ClipRequest>), clips: [] },
    ]
    render(<Dialogue exchanges={exchanges} video={video} moments={[moment()]} active={moment()} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(said()).toContain('Here are the best 2 of the 5 I found.')
  })

  it("a kept moment's news follows its file: cutting, then ready — or not", () => {
    const exchanges: Exchange[] = [{ request: request({ matches: [match({ feedback: 'approved' })] }), clips: [] }]
    const kept = (production: FeedMoment['production']) => [moment({ decision: 'kept', production })]
    const { rerender } = render(<Dialogue exchanges={exchanges} video={video} moments={kept('producing')} active={undefined} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(said()).toContain('Kept. Cutting "Harbour skyline" to 9:16 now.')
    rerender(<Dialogue exchanges={exchanges} video={video} moments={kept('produced')} active={undefined} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(said()).toContain('"Harbour skyline" is ready — download it or publish it from the card.')
    rerender(<Dialogue exchanges={exchanges} video={video} moments={kept('failed')} active={undefined} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(said()).toContain('I couldn\'t finish cutting "Harbour skyline". Keep it again to retry.')
  })

  it('says things in the order they happened: a keep, then a re-cut, then a later keep', async () => {
    // Codex's finding on #87: a Keep made after a re-cut sat above the re-cut.
    const exchanges: Exchange[] = [{ request: request({ matches: [match({ feedback: 'approved' }), match({ id: 'm2' })] }), clips: [] }]
    const first = moment({ decision: 'kept', production: 'producing' })
    const second = moment({ match: match({ id: 'm2', description: 'The dunk' }) })
    const onReclip = vi.fn()
    const { rerender } = render(<Dialogue exchanges={exchanges} video={video} moments={[first, second]} active={second} searching={false} onAsk={vi.fn()} onReclip={onReclip} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask for a moment' }), 're-cut it{enter}')
    expect(onReclip).toHaveBeenCalledWith(second)
    const secondKept = moment({ match: match({ id: 'm2', description: 'The dunk' }), decision: 'kept', production: 'producing' })
    rerender(<Dialogue exchanges={exchanges} video={video} moments={[first, secondKept]} active={secondKept} searching={false} onAsk={vi.fn()} onReclip={onReclip} />)
    const lines = said()
    expect(lines.indexOf('Kept. Cutting "Harbour skyline" to 9:16 now.')).toBeLessThan(lines.findIndex((line) => line?.includes('"The dunk" — same moment')))
    expect(lines.at(-1)).toBe('Kept. Cutting "The dunk" to 9:16 now.')
  })

  it('takes a question as soon as the upload has landed, and says what it is waiting on before then', () => {
    const landed = { ...video, status: 'preprocessing', readyForSearch: false, acceptsQuestions: true } as unknown as Video
    render(<Dialogue exchanges={[]} video={landed} moments={[]} active={undefined} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Ask for a moment' }).getAttribute('contenteditable')).toBe('true')
    cleanup()
    const uploading = { ...video, status: 'pending_upload', readyForSearch: false, acceptsQuestions: false } as unknown as Video
    render(<Dialogue exchanges={[]} video={uploading} moments={[]} active={undefined} searching={false} onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Ask for a moment' }).getAttribute('contenteditable')).toBe('false')
    expect(document.body.textContent).toContain('Your video is still uploading…')
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
    // And the box looks like it holds it: the placeholder is a separate
    // layer, and restoring the text without telling the composer it is no
    // longer empty leaves "Ask for a moment…" drawn over the question.
    // Waited for, not asserted flat: the restore lands in a state update, and
    // a bare assertion passed alone and failed inside the full suite.
    await waitFor(() => expect(screen.queryByText('Ask for a moment…')).toBeNull())

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

  it('while a search runs, says what it is doing and what it has found so far — as so far — and takes no second question', () => {
    const exchanges: Exchange[] = [
      { request: request({ status: 'searching', progress: { stage: 'search', percent: 20, chunksTotal: 5, chunksCompleted: 2, chunksFailed: 0, message: 'Reading 1 of 5', candidatesFound: 3 } }), clips: [] },
    ]
    render(<Dialogue exchanges={exchanges} video={video} moments={[]} active={undefined} searching onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(said()[0]).toBe("I'll look for that.")
    expect(said()).toContain('Watching the footage — 2 of 5 parts…')
    // Provisional, and worded as such: the finished count can be lower.
    expect(said()).toContain('3 possible moments so far…')
    expect(document.body.textContent).not.toContain('Found 3')
    // The backend's own progress string is not printed word for word into
    // the conversation. The exact numbers live in the activity row.
    expect(document.body.textContent).not.toContain('Reading 1 of 5')
    expect(document.body.textContent).toContain('2/5')
    // A contentEditable cannot be `disabled`; it is made uneditable instead,
    // which is how the composer refuses a second question mid-search.
    expect(screen.getByRole('textbox', { name: 'Ask for a moment' }).getAttribute('contenteditable')).toBe('false')
  })

  it("while the video is still being prepared, the search says so — from the video's state, not a timer", () => {
    const pending = request({ status: 'pending', progress: { stage: 'queued', percent: 0, chunksTotal: 0, chunksCompleted: 0, chunksFailed: 0, message: '' } })
    const preparing = { ...video, status: 'preprocessing', readyForSearch: false, acceptsQuestions: true } as unknown as Video
    const { rerender } = render(<Dialogue exchanges={[{ request: pending, clips: [] }]} video={preparing} moments={[]} active={undefined} searching onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(said()).toContain('Getting your video ready to look through…')
    const reading = { ...video, status: 'ready', readyForSearch: true, acceptsQuestions: true, index: { status: 'running', readThroughSeconds: 60 } } as unknown as Video
    rerender(<Dialogue exchanges={[{ request: pending, clips: [] }]} video={reading} moments={[]} active={undefined} searching onAsk={vi.fn()} onReclip={vi.fn()} />)
    expect(said()).toContain("Reading your video first, then I'll look…")
    expect(said()).not.toContain('Getting your video ready to look through…')
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
    expect(said()).toEqual(["I'll look for that.", 'Found one moment.', "I couldn't look at 1m 30s of this video (1:00–2:30), so I'd have missed anything there."])
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

  it('a re-cut can name its moment by number, the way the feed counts', async () => {
    // The tester of 2026-09-04: "re-cut video 4. I like the way it starts.
    // but it should cut at timecode 09:14" — from the end card, so nothing
    // was on screen, and the fourth moment was the one she meant.
    const first = moment()
    const fourth = moment({ match: match({ id: 'm4', description: 'The punchline' }) })
    const moments = [first, moment({ match: match({ id: 'm2' }) }), moment({ match: match({ id: 'm3' }) }), fourth]
    const ask = async (text: string) => {
      const onReclip = vi.fn()
      render(<Dialogue exchanges={[]} video={video} moments={moments} active={undefined} searching={false} onAsk={vi.fn()} onReclip={onReclip} />)
      await userEvent.type(screen.getByRole('textbox', { name: 'Ask for a moment' }), `${text}{enter}`)
      const last = said().at(-1)
      cleanup()
      return { onReclip, last }
    }

    const named = await ask('re-cut video 4. I like the way it starts. but it should cut at timecode 09:14')
    expect(named.onReclip).toHaveBeenCalledWith(fourth)
    // The note names the moment that was meant, and follows it from here.
    expect(named.last).toContain('"The punchline"')

    // A number the feed does not reach is answered with what the feed has.
    const beyond = await ask('re-cut clip 7')
    expect(beyond.onReclip).not.toHaveBeenCalled()
    expect(beyond.last).toBe("There's no moment 7 here — there are 4.")

    // No number and nothing on screen: say how to name one.
    const bare = await ask('re-cut it')
    expect(bare.onReclip).not.toHaveBeenCalled()
    expect(bare.last).toContain('say which')
  })

  it('refuses a re-cut it cannot give, in words', async () => {
    const onReclip = vi.fn()
    render(<Dialogue exchanges={[]} video={video} moments={[]} active={moment({ match: match({ reclipsRemaining: 0 }) })} searching={false} onAsk={vi.fn()} onReclip={onReclip} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask for a moment' }), 're-cut it{enter}')
    expect(onReclip).not.toHaveBeenCalled()
    expect(screen.getByTestId('dialogue-model').textContent).toContain('has used all its re-cuts')
  })
})
