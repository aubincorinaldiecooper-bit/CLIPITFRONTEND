import { describe, expect, it } from 'vitest'
import { acknowledgeLine, answerLine, candidatesLine, coverageLine, productionLine, progressLine } from '../components/start/answer-words'
import type { Video } from '../lib/types'
import type { ClipRequest } from '../lib/types'

/** The dialogue's words about a search must be true to the count and the clock. */

const request = (overrides: Partial<ClipRequest>): ClipRequest =>
  ({
    id: 'r1',
    status: 'completed',
    error: null,
    uncertain: [],
    coverage: { complete: true, locatable: true, unsearchedSeconds: 0, gaps: [], degraded: [] },
    matches: [],
    ...overrides,
  }) as ClipRequest

const uncertain = (start: number) => ({ startSeconds: start, endSeconds: start + 5, startTimecode: `0:${start}`, endTimecode: `0:${start + 5}`, confidence: 0.4, description: '' })

const found = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}` })) as never

describe('acknowledgeLine — promises to look, not what will be found', () => {
  it('acknowledges at once, and a follow-up as a follow-up', () => {
    expect(acknowledgeLine('find the cigar', false)).toBe("I'll look for that.")
    expect(acknowledgeLine('find the cigar', true)).toBe("I'll look for that too.")
  })
  it('hears a question about every appearance', () => {
    expect(acknowledgeLine('every time the crowd cheers', false)).toBe("I'll look for every one of those.")
    expect(acknowledgeLine('how many times does he sip', true)).toBe("I'll look for every one of those too.")
  })
})

describe('progressLine — what the search is doing, from state', () => {
  const video = (overrides: Partial<Video>): Video => ({ status: 'ready', readyForSearch: true, index: { status: 'ready' }, ...overrides }) as Video
  const searching = (done: number, total: number) =>
    request({ status: 'searching', progress: { stage: 'search', percent: 0, chunksTotal: total, chunksCompleted: done, chunksFailed: 0, message: 'Reading 3 of 8' } })

  it('says the video is being prepared while it is', () => {
    expect(progressLine(request({ status: 'pending' }), video({ status: 'preprocessing', readyForSearch: false }))).toBe('Getting your video ready to look through…')
  })
  it('says the notes are still being written while they are', () => {
    expect(progressLine(request({ status: 'pending' }), video({ index: { status: 'running' } as never }))).toBe("Reading your video first, then I'll look…")
  })
  it('counts the parts of the footage watched, in its own words', () => {
    expect(progressLine(searching(3, 8), video({}))).toBe('Watching the footage — 3 of 8 parts…')
    expect(progressLine(searching(3, 8), video({}))).not.toContain('Reading 3 of 8')
  })
  it('otherwise is simply looking', () => {
    expect(progressLine(request({ status: 'pending' }), video({}))).toBe('Looking through your video…')
    expect(progressLine(request({ status: 'pending' }), null)).toBe('Looking through your video…')
  })
})

describe('candidatesLine — provisional, and worded as such', () => {
  it('counts what has been found so far only while the search runs', () => {
    expect(candidatesLine(request({ status: 'searching', progress: { candidatesFound: 1 } as never }))).toBe('1 possible moment so far…')
    expect(candidatesLine(request({ status: 'searching', progress: { candidatesFound: 4 } as never }))).toBe('4 possible moments so far…')
    expect(candidatesLine(request({ status: 'searching', progress: { candidatesFound: 0 } as never }))).toBeNull()
    expect(candidatesLine(request({ status: 'completed', progress: { candidatesFound: 4 } as never }))).toBeNull()
  })
})

describe('answerLine', () => {
  it('counts the moments it is unsure about', () => {
    expect(answerLine(request({ uncertain: [uncertain(10)] }))).toContain('there is one')
    expect(answerLine(request({ uncertain: [uncertain(10), uncertain(30), uncertain(50)] }))).toContain('there are 3')
  })

  it('speaks the finished count, and a follow-up as a follow-up', () => {
    expect(answerLine(request({ matches: found(1) }))).toBe('Found one moment.')
    expect(answerLine(request({ matches: found(4) }))).toBe('Found 4 moments.')
    expect(answerLine(request({ matches: found(2) }), null, true)).toBe('Found 2 moments for that too.')
  })

  it('says how many a written number held back', () => {
    expect(answerLine(request({ matches: found(3), deck: { requestedResultCount: 3, availableCandidateCount: 7, effectiveDeckTarget: 3 } }))).toBe('Here are the best 3 of the 7 I found.')
    // Nothing held back: no "of".
    expect(answerLine(request({ matches: found(3), deck: { requestedResultCount: null, availableCandidateCount: 3, effectiveDeckTarget: 3 } }))).toBe('Found 3 moments.')
  })

  it('says so when fewer fit than were asked for, instead of padding or staying quiet', () => {
    // The tester of 2026-09-04 asked for five and got four, with no word about it.
    expect(answerLine(request({ matches: found(4), deck: { requestedResultCount: 5, availableCandidateCount: 4, effectiveDeckTarget: 4 } }))).toBe('You asked for 5 — I found 4 that fit.')
    expect(answerLine(request({ matches: found(1), deck: { requestedResultCount: 3, availableCandidateCount: 1, effectiveDeckTarget: 1 } }))).toBe('You asked for 3 — I found one that fits.')
  })

  it('finding nothing is an answer', () => {
    expect(answerLine(request({ matches: [] }))).toBe("I couldn't find a clear moment where that happens. Try describing it another way.")
  })
})

describe('productionLine — what has become of a kept moment', () => {
  it('follows the file', () => {
    expect(productionLine('The dunk', 'producing')).toBe('Kept. Cutting "The dunk" to 9:16 now.')
    expect(productionLine('The dunk', 'produced')).toBe('"The dunk" is ready — download it or publish it from the card.')
    expect(productionLine('The dunk', 'failed')).toBe('I couldn\'t finish cutting "The dunk". Keep it again to retry.')
    expect(productionLine('', null)).toBe('Kept "that moment".')
  })
})

describe('coverageLine', () => {
  it('measures only the stretches it could not look at, not footage it simply has not reached yet', () => {
    const line = coverageLine(
      request({
        coverage: {
          complete: false,
          locatable: true,
          // 90s refused plus 600s not read yet: the answer line covers the latter.
          unsearchedSeconds: 690,
          gaps: [
            { startSeconds: 60, endSeconds: 150, startTimecode: '1:00', endTimecode: '2:30', reason: 'provider_refused' },
            { startSeconds: 900, endSeconds: 1500, startTimecode: '15:00', endTimecode: '25:00', reason: 'not_read_yet' },
          ],
          degraded: [],
        },
      }),
    )
    expect(line).toContain('1m 30s')
    expect(line).toContain('(1:00–2:30)')
    expect(line).not.toContain('15:00')
  })
})
