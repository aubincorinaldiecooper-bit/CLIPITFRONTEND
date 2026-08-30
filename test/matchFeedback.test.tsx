import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MatchFeedbackControls } from '../components/theater/match-feedback'
import type { ClipMatch } from '../lib/types'

/**
 * The owner's rules for the judgment row, held by tests:
 *
 * - the thumbs are ICONS, always visible, never replaced by text;
 * - the chosen icon fills, the other stays outline, and the state renders
 *   the same from persisted data (a reload lands on the truth);
 * - a thumbs-down exposes optional reasons and demands nothing;
 * - Re-clip is available alongside any verdict, spins while pending,
 *   refuses at the limit, and "Timing is off" surfaces it as the recovery.
 */

const baseMatch = {
  id: 'match-1',
  startSeconds: 10,
  endSeconds: 20,
  startTimecode: '0:10',
  endTimecode: '0:20',
  durationSeconds: 10,
  description: 'a moment',
  confidence: 0.9,
  source: 'visual',
  quote: null,
  thumbnailUrl: null,
  feedback: null,
  feedbackReason: null,
  reclipStatus: null,
  reclipError: null,
  reclipCount: 0,
  reclipsRemaining: 2,
  clip: null,
} as unknown as ClipMatch

function renderControls(overrides: Partial<ClipMatch> = {}) {
  const onRate = vi.fn()
  const onReclip = vi.fn()
  render(
    <MatchFeedbackControls match={{ ...baseMatch, ...overrides } as ClipMatch} onRate={onRate} onReclip={onReclip} />,
  )
  return { onRate, onReclip }
}

const thumbUp = () => screen.getByRole('button', { name: /this clip is right|marked as right/i })
const thumbDown = () => screen.getByRole('button', { name: /this clip is wrong|marked as wrong/i })
const reclip = () => screen.getByRole('button', { name: /re-clip/i })
const iconOf = (button: HTMLElement) => button.querySelector('svg[data-filled]')!

beforeEach(cleanup)

describe('default state', () => {
  it('shows both thumbs as outline icons plus Re-clip', () => {
    renderControls()
    expect(iconOf(thumbUp()).getAttribute('data-filled')).toBe('false')
    expect(iconOf(thumbDown()).getAttribute('data-filled')).toBe('false')
    expect(reclip()).toBeTruthy()
  })

  it('always reserves the detail row, so a verdict cannot resize the card', () => {
    // The row exists (at its fixed height class) even with nothing to show —
    // reasons, the timing hint and failures all appear INSIDE this space.
    renderControls()
    const detail = screen.getByTestId('feedback-detail')
    expect(detail.className).toContain('h-7')
    expect(detail.textContent).toBe('')
  })
})

describe('thumbs up', () => {
  it('persists the verdict on click', async () => {
    const { onRate } = renderControls()
    await userEvent.click(thumbUp())
    expect(onRate).toHaveBeenCalledWith('approved')
  })

  it('renders approved as a FILLED up icon, down stays outline, both stay icons — no text takeover', () => {
    renderControls({ feedback: 'approved' })
    expect(iconOf(thumbUp()).getAttribute('data-filled')).toBe('true')
    expect(iconOf(thumbDown()).getAttribute('data-filled')).toBe('false')
    expect(thumbUp().getAttribute('aria-pressed')).toBe('true')
    // The old behavior replaced the icons with the word "Approved".
    expect(screen.queryByText(/approved/i)).toBeNull()
    expect(reclip()).toBeTruthy()
  })

  it('restored state fills correctly straight from persisted data (reload)', () => {
    // No clicks — this is exactly what a reload renders from the server row.
    renderControls({ feedback: 'approved' })
    expect(iconOf(thumbUp()).getAttribute('data-filled')).toBe('true')
  })

  it('tapping the filled icon again is the undo', async () => {
    const { onRate } = renderControls({ feedback: 'approved' })
    await userEvent.click(thumbUp())
    expect(onRate).toHaveBeenCalledWith(null)
  })
})

describe('thumbs down', () => {
  it('persists the verdict, fills the down icon, keeps up outline, keeps icons', () => {
    renderControls({ feedback: 'rejected' })
    expect(iconOf(thumbDown()).getAttribute('data-filled')).toBe('true')
    expect(iconOf(thumbUp()).getAttribute('data-filled')).toBe('false')
    expect(reclip()).toBeTruthy()
  })

  it('exposes the four optional reasons, none required', () => {
    renderControls({ feedback: 'rejected' })
    const reasons = screen.getByTestId('rejection-reasons')
    for (const label of ['Wrong moment', 'Missed what I wanted', 'Timing is off', 'Not useful']) {
      expect(reasons.textContent).toContain(label)
    }
  })

  it('hides the reasons until a rejection exists', () => {
    renderControls()
    expect(screen.queryByTestId('rejection-reasons')).toBeNull()
  })

  it('sends the chosen reason with the same rejection — a safe second tap', async () => {
    const { onRate } = renderControls({ feedback: 'rejected' })
    await userEvent.click(screen.getByRole('button', { name: 'Wrong moment' }))
    expect(onRate).toHaveBeenCalledWith('rejected', 'wrong_moment')
  })

  it('shows the chosen reason chip filled from persisted data, clearable in place', async () => {
    const { onRate } = renderControls({ feedback: 'rejected', feedbackReason: 'not_relevant' })
    const chosen = screen.getByRole('button', { name: 'Not useful' })
    expect(chosen.getAttribute('aria-pressed')).toBe('true')
    // The open chips collapse to the choice — same reserved row, no growth.
    expect(screen.queryByRole('button', { name: 'Wrong moment' })).toBeNull()
    await userEvent.click(chosen)
    expect(onRate).toHaveBeenCalledWith('rejected', null)
  })
})

describe('changing feedback', () => {
  it('selecting the other thumb switches which icon fills', () => {
    const { rerender } = ((): { rerender: (match: ClipMatch) => void } => {
      const onRate = vi.fn()
      const onReclip = vi.fn()
      const view = render(<MatchFeedbackControls match={{ ...baseMatch, feedback: 'approved' } as ClipMatch} onRate={onRate} onReclip={onReclip} />)
      return {
        rerender: (match) => view.rerender(<MatchFeedbackControls match={match} onRate={onRate} onReclip={onReclip} />),
      }
    })()
    expect(iconOf(thumbUp()).getAttribute('data-filled')).toBe('true')
    rerender({ ...baseMatch, feedback: 'rejected' } as ClipMatch)
    expect(iconOf(thumbUp()).getAttribute('data-filled')).toBe('false')
    expect(iconOf(thumbDown()).getAttribute('data-filled')).toBe('true')
  })
})

describe('re-clip', () => {
  it('is available without any verdict — nobody has to vote before a retry', async () => {
    const { onReclip } = renderControls()
    await userEvent.click(reclip())
    expect(onReclip).toHaveBeenCalledTimes(1)
  })

  it('spins and refuses further taps while pending', async () => {
    const { onReclip } = renderControls({ reclipStatus: 'pending' })
    const button = reclip()
    expect(button).toHaveProperty('disabled', true)
    expect(button.querySelector('svg')!.classList.contains('animate-spin')).toBe(true)
    await userEvent.click(button)
    expect(onReclip).not.toHaveBeenCalled()
  })

  it('refuses at the per-moment limit and says why', () => {
    renderControls({ reclipsRemaining: 0 })
    const button = reclip()
    expect(button).toHaveProperty('disabled', true)
    expect(button.getAttribute('title')).toMatch(/limit/i)
  })

  it('marks a re-clipped moment quietly', () => {
    renderControls({ reclipCount: 1, reclipsRemaining: 1 })
    expect(screen.getByText(/re-clipped/i)).toBeTruthy()
  })

  it('shows the failure line with the original untouched, button live again', () => {
    renderControls({ reclipStatus: 'failed', reclipError: 'The model wandered to a different moment. Nothing was changed.' })
    expect(screen.getByTestId('reclip-failure').textContent).toContain('Nothing was changed')
    expect(reclip()).toHaveProperty('disabled', false)
  })

  it('"Timing is off" surfaces Re-clip as the recovery path', async () => {
    const { onReclip } = renderControls({ feedback: 'rejected', feedbackReason: 'bad_boundaries' })
    const hint = screen.getByTestId('timing-reclip-hint')
    expect(hint.textContent).toMatch(/try that cut again/i)
    await userEvent.click(hint)
    expect(onReclip).toHaveBeenCalledTimes(1)
  })
})
