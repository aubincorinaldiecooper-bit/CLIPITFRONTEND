import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadStep } from '../components/start/upload-step'
import type { Video } from '../lib/types'
import type { UploadEntry } from '../components/flow/upload-package'

/**
 * The owner's rule for the ask box: while a video is still being prepared,
 * people can TYPE — only sending waits. The box used to be disabled outright
 * while the line beneath it promised "you can type now", which is the shape
 * of bug this file exists to keep out.
 */

const video = (readyForSearch: boolean) =>
  ({ id: 'video-1', status: readyForSearch ? 'ready' : 'processing', readyForSearch }) as unknown as Video

const uploading = (): UploadEntry => ({
  id: 'upload-1',
  file: new File(['x'], 'film.mp4', { type: 'video/mp4' }),
  phase: 'uploading',
  progress: 0.3,
})

function renderStep(props: {
  video: Video | null
  entries?: UploadEntry[]
  promptValue?: string
  onSubmit?: () => void
  onPromptChange?: (v: string) => void
}) {
  return render(
    <UploadStep
      entries={props.entries ?? []}
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

  it('opens the moment a file is picked, before its bytes have landed', () => {
    // The video row only exists once the upload completes — minutes, for a
    // long film — and those minutes are when a person wants to type.
    renderStep({ video: null, entries: [uploading()] })
    const input = screen.getByPlaceholderText<HTMLInputElement>('Tell Clipit what to look for...')
    expect(input.disabled).toBe(false)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Search' }).disabled).toBe(true)
    expect(screen.getByText(/still being prepared/)).toBeTruthy()
  })

  it('promises nothing when the only pick has failed to upload', () => {
    // A refused file (too large, say) stays in the list with its reason; it
    // is not "still being prepared".
    renderStep({ video: null, entries: [{ ...uploading(), phase: 'failed', error: 'Too large' }] })
    expect(screen.getByPlaceholderText<HTMLInputElement>('Upload a video first...').disabled).toBe(true)
    expect(screen.queryByText(/still being prepared/)).toBeNull()
  })

  it('promises nothing for a video whose preparation failed', () => {
    const failed = { id: 'video-1', status: 'failed', readyForSearch: false } as unknown as Video
    renderStep({ video: failed })
    expect(screen.getByPlaceholderText<HTMLInputElement>('Upload a video first...').disabled).toBe(true)
    expect(screen.queryByText(/still being prepared/)).toBeNull()
  })
})
