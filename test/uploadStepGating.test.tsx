import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadStep } from '../components/start/upload-step'
import type { Video } from '../lib/types'
import type { UploadEntry } from '../components/flow/upload-package'

/**
 * The owner's rule for the ask box: while a video is still on its way,
 * people can TYPE — only sending waits. The box used to be disabled outright
 * while the line beneath it promised "you can type now", which is the shape
 * of bug this file exists to keep out.
 *
 * Since 2026-09-05 sending waits only for the bytes to land: the server
 * says when it takes questions, and the answer waits for the rest inside
 * the search. An older server does not say so, and for it ready-for-search
 * is still the gate.
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
    expect(screen.getByPlaceholderText<HTMLInputElement>('Add a video, then ask').disabled).toBe(true)
  })

  it('opens the moment a file is picked, before its bytes have landed', () => {
    // The video row only exists once the upload completes — minutes, for a
    // long film — and those minutes are when a person wants to type.
    renderStep({ video: null, entries: [uploading()] })
    const input = screen.getByPlaceholderText<HTMLInputElement>('Tell Clipit what to look for...')
    expect(input.disabled).toBe(false)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Search' }).disabled).toBe(true)
    expect(screen.getByText(/still uploading/)).toBeTruthy()
  })

  it('sends as soon as the server says it takes questions, even while the video is still being prepared', async () => {
    const onSubmit = vi.fn()
    const landed = { id: 'video-1', status: 'preprocessing', readyForSearch: false, acceptsQuestions: true } as unknown as Video
    renderStep({ video: landed, promptValue: 'find the goal', onSubmit })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Search' }).disabled).toBe(false)
    expect(screen.queryByText(/still being prepared/)).toBeNull()
    await userEvent.type(screen.getByPlaceholderText('Tell Clipit what to look for...'), '{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('keeps Send off while the server says the bytes have not landed', () => {
    const uploading = { id: 'video-1', status: 'pending_upload', readyForSearch: false, acceptsQuestions: false } as unknown as Video
    renderStep({ video: uploading, promptValue: 'find the goal' })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Search' }).disabled).toBe(true)
    expect(screen.getByText(/still uploading/)).toBeTruthy()
  })

  it('promises nothing when the only pick has failed to upload', () => {
    // A refused file (too large, say) stays in the list with its reason; it
    // is not "still being prepared".
    renderStep({ video: null, entries: [{ ...uploading(), phase: 'failed', error: 'Too large' }] })
    expect(screen.getByPlaceholderText<HTMLInputElement>('Add a video, then ask').disabled).toBe(true)
    expect(screen.queryByText(/still being prepared/)).toBeNull()
  })

  it('promises nothing for a video whose preparation failed', () => {
    const failed = { id: 'video-1', status: 'failed', readyForSearch: false } as unknown as Video
    renderStep({ video: failed })
    expect(screen.getByPlaceholderText<HTMLInputElement>('Add a video, then ask').disabled).toBe(true)
    expect(screen.queryByText(/still being prepared/)).toBeNull()
  })
})

/**
 * Home is the box and nothing else — the owner's call of 2026-09-10.
 *
 * The drop container above it is gone. Uploading is NOT: "the bar can hold
 * video files so upload still exists, we're just removing the container".
 *
 * What this file is guarding is the half of that which is easy to lose. The
 * container was the only thing on the screen saying a file was on its way
 * or had failed, and deleting it without moving those words leaves someone
 * waiting on an upload that stopped minutes ago.
 */
describe('home is the box alone, and the box still takes video', () => {
  it('has no drop container on it', () => {
    renderStep({ video: null })
    expect(screen.queryByText(/drag/i)).toBeNull()
    expect(screen.queryByText(/drop/i)).toBeNull()
    // The container's own picker button is gone with it; the bar's remains.
    expect(screen.queryByRole('button', { name: /browse|choose file/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add a video' })).toBeTruthy()
  })

  it('hands a picked video to the same uploader the container used', async () => {
    const onAdd = vi.fn()
    render(
      <UploadStep
        entries={[]} video={null} promptValue="" onPromptChange={vi.fn()}
        onAdd={onAdd} onRemove={vi.fn()} onRetry={vi.fn()} onSubmit={vi.fn()}
      />,
    )
    const file = new File(['x'], 'harbour.mp4', { type: 'video/mp4' })
    // The picker is hidden behind the paperclip, so the file goes to it
    // directly — clicking the button opens the OS dialog, which jsdom has not
    // got. What is being checked is that a pick reaches onAdd at all.
    const picker = document.querySelector<HTMLInputElement>('input[type="file"]')!
    expect(picker.accept).toContain('video/')
    await userEvent.upload(picker, file)
    expect(onAdd).toHaveBeenCalledWith([file])
  })

  it('says a file is on its way, since the progress bar went with the container', () => {
    renderStep({ video: null, entries: [uploading()] })
    const line = screen.getByTestId('upload-progress').textContent ?? ''
    expect(line).toContain('film.mp4')
    expect(line).toContain('30%')
  })

  it('says why an upload failed, and offers the same two ways out', async () => {
    // Without this the file simply vanishes and the box says "add a video",
    // as though nothing had been added — which is the misleading half of
    // "nothing happened".
    const onRetry = vi.fn()
    const onRemove = vi.fn()
    render(
      <UploadStep
        entries={[{ ...uploading(), phase: 'failed', error: 'Too large' }]}
        video={null} promptValue="" onPromptChange={vi.fn()}
        onAdd={vi.fn()} onRemove={onRemove} onRetry={onRetry} onSubmit={vi.fn()}
      />,
    )
    const failure = screen.getByTestId('upload-failure').textContent ?? ''
    expect(failure).toContain('film.mp4')
    expect(failure).toContain('Too large')

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledWith('upload-1')
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledWith('upload-1')
  })
})
