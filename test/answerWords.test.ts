import { describe, expect, it } from 'vitest'
import { answerLine, coverageLine } from '../components/start/answer-words'
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

describe('answerLine', () => {
  it('counts the moments it is unsure about', () => {
    expect(answerLine(request({ uncertain: [uncertain(10)] }))).toContain('there is one')
    expect(answerLine(request({ uncertain: [uncertain(10), uncertain(30), uncertain(50)] }))).toContain('there are 3')
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
