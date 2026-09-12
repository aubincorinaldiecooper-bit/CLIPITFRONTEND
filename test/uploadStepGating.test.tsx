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

/**
 * The box on home is Astryx's composer now, not the outlined pill it used to
 * be — the owner's call of 2026-09-10, "the same search input bar i shared".
 * The bar changed; the RULE it has to keep did not, which is what this file
 * is for. So these read the new box rather than the old one:
 *
 *   - the field is a contenteditable, not an <input>. It says whether it
 *     will take typing with `contenteditable`, where the old one used
 *     `disabled`.
 *   - the action is called Send, and it was called Search.
 */
const box = () => screen.getByRole('textbox', { name: 'Search your footage' })
const takesTyping = () => box().getAttribute('contenteditable') === 'true'
const send = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Send' })
describe('the ask box while a video is still being prepared', () => {
  it('lets people type, and keeps Send off', async () => {
    const onPromptChange = vi.fn()
    renderStep({ video: video(false), onPromptChange })

    expect(takesTyping()).toBe(true)
    await userEvent.type(box(), 'f')
    expect(onPromptChange).toHaveBeenCalledWith('f')

    expect(send().disabled).toBe(true)
  })

  it('does not send on Enter either', async () => {
    const onSubmit = vi.fn()
    renderStep({ video: video(false), promptValue: 'find the goal', onSubmit })

    await userEvent.type(box(), '{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('sends once the video is ready', async () => {
    const onSubmit = vi.fn()
    renderStep({ video: video(true), promptValue: 'find the goal', onSubmit })

    expect(send().disabled).toBe(false)
    await userEvent.type(box(), '{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('accepts a question before a video is picked, while keeping Send off', async () => {
    const onPromptChange = vi.fn()
    renderStep({ video: null, onPromptChange })
    expect(takesTyping()).toBe(true)
    expect(screen.getByText('Ask anything...')).toBeTruthy()
    await userEvent.type(box(), 'find the introduction')
    expect(onPromptChange).toHaveBeenLastCalledWith('find the introduction')
    expect(send().disabled).toBe(true)
  })

  it('opens the moment a file is picked, before its bytes have landed', async () => {
    // The video row only exists once the upload completes — minutes, for a
    // long film — and those minutes are when a person wants to type.
    renderStep({ video: null, entries: [uploading()] })
    expect(takesTyping()).toBe(true)
    expect(send().disabled).toBe(true)
    // The file is on screen as itself while it goes up.
    expect(screen.getByRole('button', { name: /^film\.mp4 — uploading/ })).toBeTruthy()
  })

  it('sends as soon as the server says it takes questions, even while the video is still being prepared', async () => {
    const onSubmit = vi.fn()
    const landed = { id: 'video-1', status: 'preprocessing', readyForSearch: false, acceptsQuestions: true } as unknown as Video
    renderStep({ video: landed, promptValue: 'find the goal', onSubmit })
    expect(send().disabled).toBe(false)
    expect(screen.queryByText(/still being prepared/)).toBeNull()
    await userEvent.type(box(), '{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('keeps Send off while the server says the bytes have not landed', () => {
    const uploading = { id: 'video-1', status: 'pending_upload', readyForSearch: false, acceptsQuestions: false } as unknown as Video
    renderStep({ video: uploading, promptValue: 'find the goal' })
    expect(send().disabled).toBe(true)
  })

  it('still accepts a question when the only pick failed, without promising it can send', async () => {
    // A refused file (too large, say) stays in the list with its reason; it
    // is not "still being prepared".
    renderStep({ video: null, entries: [{ ...uploading(), phase: 'failed', error: 'Too large' }] })
    expect(takesTyping()).toBe(true)
    expect(send().disabled).toBe(true)
    expect(screen.queryByText(/still being prepared/)).toBeNull()
  })

  it('still accepts a question after preparation failed, without promising it can send', async () => {
    const failed = { id: 'video-1', status: 'failed', readyForSearch: false } as unknown as Video
    renderStep({ video: failed })
    expect(takesTyping()).toBe(true)
    expect(send().disabled).toBe(true)
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

  it('shows the file itself while it goes up, not a line of text about it', () => {
    // What was here was a filename and a percentage in grey under the box.
    // The owner's call of 2026-09-10: that is a log line, not feedback.
    renderStep({ video: null, entries: [uploading()] })

    // A thumbnail of the video, drawn from the file before a byte has landed.
    const thumb = screen.getByRole('button', { name: /^film\.mp4 — uploading/ })
    expect(thumb.querySelector('video')).toBeTruthy()

    // The percentage is not drawn — a spinner is — but it is not thrown away
    // either: it is the one thing a spinning circle cannot tell a screen
    // reader, so it stays in the label.
    expect(thumb.getAttribute('aria-label')).toBe('film.mp4 — uploading, 30%')

    // And no text line survives.
    expect(screen.queryByTestId('upload-progress')).toBeNull()
    expect(screen.queryByText(/still uploading/)).toBeNull()
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
    // The thumbnail says which file and why, so a failure cannot go quiet.
    expect(
      screen.getByRole('button', { name: 'film.mp4 — Too large' }),
    ).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledWith('upload-1')
    await userEvent.click(screen.getByRole('button', { name: 'Remove film.mp4' }))
    expect(onRemove).toHaveBeenCalledWith('upload-1')
  })
})
