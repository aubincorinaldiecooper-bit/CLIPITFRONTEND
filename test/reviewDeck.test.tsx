import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ChannelToggle,
  DeckControls,
  DeckEndState,
  KeptGrid,
  ReclipCardButton,
  SkipPill,
  deckQueue,
} from '../components/theater/review-deck'
import type { ClipMatch } from '../lib/types'

/**
 * The owner's review flow, held by tests: one moment at a time; Keep, Skip
 * and Re-clip are decisions, not ratings. A decision briefly fills its
 * control and the card leaves the queue; Re-clip holds the card; failure
 * hands the controls back with the original intact.
 */

const match = (overrides: Partial<ClipMatch> = {}) =>
  ({
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
    ...overrides,
  }) as unknown as ClipMatch

beforeEach(cleanup)

describe('deckQueue — the active review queue', () => {
  it('holds only undecided moments, strongest first', () => {
    const queue = deckQueue([
      match({ id: 'kept', feedback: 'approved', confidence: 0.99 }),
      match({ id: 'weak', confidence: 0.4 }),
      match({ id: 'skipped', feedback: 'rejected', confidence: 0.95 }),
      match({ id: 'strong', confidence: 0.9 }),
    ])
    // Kept and skipped cards have LEFT the deck — nothing decided lingers.
    expect(queue.map((m) => m.id)).toEqual(['strong', 'weak'])
  })

  it('advances when the front card is decided', () => {
    const before = deckQueue([match({ id: 'a', confidence: 0.9 }), match({ id: 'b', confidence: 0.8 })])
    expect(before[0]!.id).toBe('a')
    const after = deckQueue([
      match({ id: 'a', confidence: 0.9, feedback: 'approved' }),
      match({ id: 'b', confidence: 0.8 }),
    ])
    expect(after[0]!.id).toBe('b')
  })

  it('keeps a moment mid-Re-clip in the deck — its decision is still open', () => {
    const queue = deckQueue([match({ id: 'a', reclipStatus: 'pending' })])
    expect(queue).toHaveLength(1)
  })
})

describe('DeckControls — Skip / Keep', () => {
  it('shows both decisions, unfilled, when nothing has been chosen', () => {
    render(<DeckControls onSkip={vi.fn()} onKeep={vi.fn()} disabled={false} deciding={null} />)
    expect(screen.getByRole('button', { name: /skip/i }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: /keep/i }).getAttribute('aria-pressed')).toBe('false')
  })

  it('fires Keep immediately on tap — persist first, confirm second', async () => {
    const onKeep = vi.fn()
    render(<DeckControls onSkip={vi.fn()} onKeep={onKeep} disabled={false} deciding={null} />)
    await userEvent.click(screen.getByRole('button', { name: /keep/i }))
    expect(onKeep).toHaveBeenCalledTimes(1)
  })

  it('fires Skip immediately on tap', async () => {
    const onSkip = vi.fn()
    render(<DeckControls onSkip={onSkip} onKeep={vi.fn()} disabled={false} deciding={null} />)
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('fills the chosen control during the confirmation beat and blocks a second decision', async () => {
    const onKeep = vi.fn()
    const onSkip = vi.fn()
    render(<DeckControls onSkip={onSkip} onKeep={onKeep} disabled={false} deciding="keep" />)
    expect(screen.getByRole('button', { name: /keep/i }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /skip/i }).getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(screen.getByRole('button', { name: /keep/i }))
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onKeep).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('refuses both decisions while the card is being re-clipped', async () => {
    const onKeep = vi.fn()
    render(<DeckControls onSkip={vi.fn()} onKeep={onKeep} disabled={true} deciding={null} />)
    await userEvent.click(screen.getByRole('button', { name: /keep/i }))
    expect(onKeep).not.toHaveBeenCalled()
  })
})

describe('ReclipCardButton — refine this exact clip', () => {
  it('asks for a re-cut of the SAME moment', async () => {
    const onReclip = vi.fn()
    render(<ReclipCardButton pending={false} remaining={2} onReclip={onReclip} />)
    const button = screen.getByRole('button', { name: /re-clip/i })
    expect(button.getAttribute('title')).toMatch(/same moment/i)
    await userEvent.click(button)
    expect(onReclip).toHaveBeenCalledTimes(1)
  })

  it('spins and refuses duplicate requests while one runs', async () => {
    const onReclip = vi.fn()
    render(<ReclipCardButton pending={true} remaining={2} onReclip={onReclip} />)
    const button = screen.getByRole('button', { name: /re-clip/i })
    expect(button).toHaveProperty('disabled', true)
    expect(button.querySelector('svg')!.classList.contains('animate-spin')).toBe(true)
    await userEvent.click(button)
    expect(onReclip).not.toHaveBeenCalled()
  })

  it('refuses at the per-moment limit and says why', () => {
    render(<ReclipCardButton pending={false} remaining={0} onReclip={vi.fn()} />)
    const button = screen.getByRole('button', { name: /re-clip/i })
    expect(button).toHaveProperty('disabled', true)
    expect(button.getAttribute('title')).toMatch(/limit/i)
  })
})

describe('SkipPill — the optional word after a fast skip', () => {
  it('offers Undo and the four reasons, none required', () => {
    render(<SkipPill match={match({ feedback: 'rejected' })} onUndo={vi.fn()} onReason={vi.fn()} onReclipInstead={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    for (const label of ['Wrong moment', 'Missed what I wanted', 'Timing is off', 'Not useful']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('Undo brings the moment back', async () => {
    const onUndo = vi.fn()
    render(<SkipPill match={match({ feedback: 'rejected' })} onUndo={onUndo} onReason={vi.fn()} onReclipInstead={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('a reason rides the already-persisted skip — never a form in the way', async () => {
    const onReason = vi.fn()
    render(<SkipPill match={match({ feedback: 'rejected' })} onUndo={vi.fn()} onReason={onReason} onReclipInstead={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Timing is off' }))
    expect(onReason).toHaveBeenCalledWith('bad_boundaries')
  })

  it('"Timing is off" surfaces Re-clip as the recovery, never a trim editor', async () => {
    const onReclipInstead = vi.fn()
    render(
      <SkipPill
        match={match({ feedback: 'rejected', feedbackReason: 'bad_boundaries' })}
        onUndo={vi.fn()}
        onReason={vi.fn()}
        onReclipInstead={onReclipInstead}
      />,
    )
    await userEvent.click(screen.getByTestId('reclip-instead'))
    expect(onReclipInstead).toHaveBeenCalledTimes(1)
  })

  it('offers no recovery once the Re-clip allowance is spent', () => {
    render(
      <SkipPill
        match={match({ feedback: 'rejected', feedbackReason: 'bad_boundaries', reclipsRemaining: 0 })}
        onUndo={vi.fn()}
        onReason={vi.fn()}
        onReclipInstead={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('reclip-instead')).toBeNull()
  })
})

describe('DeckEndState — the deck ran out with nothing kept', () => {
  it('offers both ways onward, per the owner\'s screen', () => {
    const onUploadMore = vi.fn()
    render(<DeckEndState kept={3} total={5} onUploadMore={onUploadMore} />)
    const end = screen.getByTestId('deck-end')
    expect(end.textContent).toContain("That's every moment")
    expect(screen.getByRole('button', { name: 'Upload more video' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /library/i }).getAttribute('href')).toBe('/clips')
  })

  it('says plainly that everything was skipped, and suggests asking differently', () => {
    render(<DeckEndState kept={0} total={4} />)
    expect(screen.getByTestId('deck-end').textContent).toContain('skipped all 4')
  })
})

describe('KeptGrid — the outcome, told truthfully per tile', () => {
  const tile = (overrides: Record<string, unknown> = {}) => ({
    id: 'clip-1',
    title: 'Green Mercedes reveal',
    videoTitle: 'night-shoot.mp4',
    duration: '0:31',
    url: 'https://cdn/clip.mp4',
    poster: null,
    status: 'ready' as const,
    error: null,
    ...overrides,
  })

  it('shows count, names and lengths, and publishing goes on when something is ready', async () => {
    const onReview = vi.fn()
    render(
      <KeptGrid
        clips={[tile(), tile({ id: 'clip-2', title: 'Gas station at night', duration: '0:19' })]}
        onReview={onReview}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    const grid = screen.getByTestId('kept-grid')
    expect(grid.textContent).toContain('2 clips kept')
    expect(grid.textContent).toContain('Green Mercedes reveal')
    expect(grid.textContent).toContain('0:19')
    await userEvent.click(screen.getByRole('button', { name: 'Publish all 2' }))
    expect(onReview).toHaveBeenCalledTimes(1)
  })

  it('every kept clip carries its own Publish', async () => {
    const onPublish = vi.fn()
    render(
      <KeptGrid clips={[tile()]} onReview={vi.fn()} onPublish={onPublish} onRename={vi.fn()} onDelete={vi.fn()} />,
    )
    await userEvent.click(screen.getAllByRole('button', { name: 'Publish' })[0]!)
    expect(onPublish).toHaveBeenCalledWith('clip-1')
  })

  it('a keep still cutting says so, and cannot be published', () => {
    render(
      <KeptGrid
        clips={[tile({ status: 'cutting', url: null, duration: null })]}
        onReview={vi.fn()}
        onPublish={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByTestId('kept-grid').textContent).toContain('Cutting…')
    expect(screen.getByRole('button', { name: 'Publish' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: /Publish this clip/ })).toHaveProperty('disabled', true)
  })

  it('a failed cut shows its reason instead of a green rectangle', () => {
    render(
      <KeptGrid
        clips={[tile({ status: 'failed', url: null, error: 'The source stream dropped.' })]}
        onReview={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByTestId('kept-grid').textContent).toContain('The source stream dropped.')
  })
})

describe('ChannelToggle — a channel is on, off, or unavailable', () => {
  it('reports its state as a switch, not a decoration', async () => {
    const onToggle = vi.fn()
    render(<ChannelToggle on={true} disabled={false} onToggle={onToggle} label="Post to TikTok" />)
    const toggle = screen.getByRole('switch', { name: 'Post to TikTok' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    await userEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('an unconnected channel cannot be switched on here', async () => {
    const onToggle = vi.fn()
    render(<ChannelToggle on={false} disabled onToggle={onToggle} label="YouTube Shorts is not connected" />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveProperty('disabled', true)
    await userEvent.click(toggle)
    expect(onToggle).not.toHaveBeenCalled()
  })
})
