import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadStep } from '../components/start/upload-step'
import type { Video } from '../lib/types'

/**
 * The owner's rule for the ask box: while a video is still being prepared,
 * people can TYPE — only sending waits. The box used to be disabled outright
 * while the line beneath it promised "you can type now", which is the shape
 * of bug this file exists to keep out.
 */

const video = (readyForSearch: boolean) =>
  ({ id: 'video-1', status: readyForSearch ? 'ready' : 'processing', readyForSearch }) as unknown as Video

function renderStep(props: { video: Video | null; promptValue?: string; onSubmit?: () => void; onPromptChange?: (v: string) => void }) {
  return render(
    <UploadStep
      entries={[]}
      video={props.video}
      promptValue={props.promptValue ?? ''}
      onPromptChange={props.onPromptChange ?? vi.fn()}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
      onRetry={vi.fn()}
      onSubmit={props.onSubmit ?? vi.fn()}
    />,
  )
}

// jsdom has no matchMedia; the step's reduced-motion hook asks for it on render.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }),
})

afterEach(cleanup)

describe('the ask box while a video is still being prepared', () => {
  it('lets people type, and keeps Send off', async () => {
    const onPromptChange = vi.fn()
    renderStep({ video: video(false), onPromptChange })

    const input = screen.getByPlaceholderText<HTMLInputElement>('Tell Clipit what to look for...')
    expect(input.disabled).toBe(false)
    await userEvent.type(input, 'f')
    expect(onPromptChange).toHaveBeenCalledWith('f')

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Search' }).disabled).toBe(true)
  })

  it('does not send on Enter either', async () => {
    const onSubmit = vi.fn()
    renderStep({ video: video(false), promptValue: 'find the goal', onSubmit })

    await userEvent.type(screen.getByPlaceholderText('Tell Clipit what to look for...'), '{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('sends once the video is ready', async () => {
    const onSubmit = vi.fn()
    renderStep({ video: video(true), promptValue: 'find the goal', onSubmit })

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Search' }).disabled).toBe(false)
    await userEvent.type(screen.getByPlaceholderText('Tell Clipit what to look for...'), '{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('stays off with nothing to ask about', () => {
    renderStep({ video: null })
    expect(screen.getByPlaceholderText<HTMLInputElement>('Upload a video first...').disabled).toBe(true)
  })
})
