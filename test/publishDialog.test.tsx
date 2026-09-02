import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Publishing one moment from the feed — the owner's screens of 2026-09-02
 * in a dialog: every channel on the list with its own Connect, connecting
 * without leaving the screen, and Publish as one control that tells the
 * truth in place — Uploading…, Published (inactive) on the platforms'
 * word, Sent when that word is slow, Try again when refused.
 */

const TIKTOK = { id: 'acc-1', platform: 'tiktok', displayName: '@clipit', status: 'connected' }
const YOUTUBE = { id: 'acc-2', platform: 'youtube', displayName: 'Clipit', status: 'connected' }
const post = (outcome: 'posting' | 'posted' | 'failed', status = outcome === 'posted' ? 'published' : outcome === 'failed' ? 'failed' : 'submitted') => ({
  id: 'p1', clipId: 'c-a', status, outcome, targets: [{ platform: 'tiktok', accountId: 'acc-1' }], createdAt: '2026-09-02T18:00:00.000Z',
})

const api = {
  listSocialAccounts: vi.fn(async () => ({ configured: true, signInRequired: false, accounts: [TIKTOK] })),
  publishClip: vi.fn(async () => ({ posts: [{ id: 'p1', status: 'submitted', aspect: '9:16', targets: [{ platform: 'tiktok' }] }] })),
  listClipPosts: vi.fn(async () => ({ posts: [post('posted')] })),
  getConnectUrl: vi.fn(async (platform: string) => ({ platform, url: `https://zernio.test/connect/${platform}` })),
}
class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}
vi.mock('@/lib/api', () => ({ api, ApiError }))

// jsdom has no matchMedia or ResizeObserver, and only half a <dialog>: Astryx's
// own tests stub showModal and close the same way.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open') }
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
})
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }

const { PublishDialog } = await import('../components/start/publish-dialog')

const clip = { id: 'c-a', title: 'The goal from the corner', ready: true }
const publishButton = () => screen.getByRole('button', { name: /^(publish|uploading…|published|sent|try again)$/i })

beforeEach(() => {
  api.listSocialAccounts.mockResolvedValue({ configured: true, signInRequired: false, accounts: [TIKTOK] })
  api.publishClip.mockResolvedValue({ posts: [{ id: 'p1', status: 'submitted', aspect: '9:16', targets: [{ platform: 'tiktok' }] }] })
  api.listClipPosts.mockResolvedValue({ posts: [post('posted')] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('PublishDialog', () => {
  it('lists every channel CLIPIT can post to, in the owner\'s order, with Connect on the ones without an account', async () => {
    render(<PublishDialog clip={clip} onClose={vi.fn()} />)
    await screen.findByText(/@clipit/)
    const rows = screen.getAllByTestId(/^channel-/).map((row) => row.getAttribute('data-testid'))
    expect(rows).toEqual(['channel-youtube', 'channel-tiktok', 'channel-instagram', 'channel-x'])
    expect(screen.getByRole('button', { name: /connect youtube shorts/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /connect x$/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /connect tiktok/i })).toBeNull()
    expect(screen.getByRole('switch', { name: /post to tiktok/i }).getAttribute('aria-checked')).toBe('true')
  })

  it('Publish sends the clip and, on the platform\'s word, becomes Published and inactive', async () => {
    render(<PublishDialog clip={clip} onClose={vi.fn()} />)
    await screen.findByText(/@clipit/)

    await userEvent.click(publishButton())

    await waitFor(() => expect(api.publishClip).toHaveBeenCalledWith('c-a', expect.objectContaining({ accountIds: ['acc-1'] })))
    await waitFor(() => expect(publishButton().getAttribute('data-phase')).toBe('published'))
    expect((publishButton() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('publish-words').textContent).toMatch(/published to tiktok/i)
    // The row says so too, where its switch was.
    expect(within(screen.getByTestId('channel-tiktok')).getByText(/^published$/i)).toBeTruthy()
  })

  it('reads Uploading… while the platforms have the clip, and Sent — still inactive — when their word is slow in coming', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    api.listClipPosts.mockResolvedValue({ posts: [post('posting')] })
    render(<PublishDialog clip={clip} onClose={vi.fn()} />)
    await screen.findByText(/@clipit/)

    await userEvent.click(publishButton())
    await waitFor(() => expect(publishButton().getAttribute('data-phase')).toBe('publishing'))
    expect((publishButton() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('publish-words').textContent).toMatch(/uploading to tiktok/i)
    expect(within(screen.getByTestId('channel-tiktok')).getByText(/uploading…/i)).toBeTruthy()

    // The platform's word arrives on a later ask.
    api.listClipPosts.mockResolvedValue({ posts: [post('posted')] })
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    await waitFor(() => expect(publishButton().getAttribute('data-phase')).toBe('published'))
  })

  it('settles for Sent, never Published, when no word comes in time', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    api.listClipPosts.mockResolvedValue({ posts: [post('posting')] })
    render(<PublishDialog clip={clip} onClose={vi.fn()} />)
    await screen.findByText(/@clipit/)
    await userEvent.click(publishButton())
    await waitFor(() => expect(publishButton().getAttribute('data-phase')).toBe('publishing'))

    vi.setSystemTime(Date.now() + 91_000)
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    await waitFor(() => expect(publishButton().getAttribute('data-phase')).toBe('sent'))
    expect((publishButton() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('publish-words').textContent).toMatch(/sent to tiktok — waiting for tiktok to confirm/i)
  })

  it('settles for Sent on the clock even while the server holds a request open, and never asks twice at once', async () => {
    // Devin's and Codex's finding on #77: the deadline sat behind the
    // request, and the interval started another ask every two seconds.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    api.listClipPosts.mockReturnValue(new Promise(() => undefined))
    render(<PublishDialog clip={clip} onClose={vi.fn()} />)
    await screen.findByText(/@clipit/)
    await userEvent.click(publishButton())
    await waitFor(() => expect(publishButton().getAttribute('data-phase')).toBe('publishing'))

    await act(async () => { await vi.advanceTimersByTimeAsync(6_000) })
    expect(api.listClipPosts).toHaveBeenCalledTimes(1)

    vi.setSystemTime(Date.now() + 91_000)
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    await waitFor(() => expect(publishButton().getAttribute('data-phase')).toBe('sent'))
  })

  it('a server that names only the singular post still holds the control: the post is asked about, and Published on its word', async () => {
    api.publishClip.mockResolvedValueOnce({ post: { id: 'p1', clipId: 'c-a', status: 'submitted' } })
    render(<PublishDialog clip={clip} onClose={vi.fn()} />)
    await screen.findByText(/@clipit/)
    await userEvent.click(publishButton())
    await waitFor(() => expect(publishButton().getAttribute('data-phase')).toBe('published'))
    expect(api.listClipPosts).toHaveBeenCalledWith('c-a', expect.any(Number))
  })

  it('a refusal is said in place and Publish becomes Try again', async () => {
    api.publishClip.mockRejectedValueOnce(new ApiError(409, 'in_flight', 'This clip is already on its way'))
    render(<PublishDialog clip={clip} onClose={vi.fn()} />)
    await screen.findByText(/@clipit/)

    await userEvent.click(publishButton())

    await waitFor(() => expect(publishButton().getAttribute('data-phase')).toBe('failed'))
    expect((publishButton() as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/this clip is already on its way/i)).toBeTruthy()

    // Try again sends it once more.
    await userEvent.click(publishButton())
    await waitFor(() => expect(api.publishClip).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(publishButton().getAttribute('data-phase')).toBe('published'))
  })

  it('Connect opens the sign-in in a window, and the row wears its mark and switches on once the account list has the channel', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    const open = vi.fn(() => popup)
    Object.defineProperty(window, 'open', { configurable: true, writable: true, value: open })
    render(<PublishDialog clip={clip} onClose={vi.fn()} />)
    await screen.findByText(/@clipit/)

    await userEvent.click(screen.getByRole('button', { name: /connect youtube shorts/i }))

    // Opened inside the click, addressed once the server minted the URL.
    expect(open).toHaveBeenCalledWith('about:blank', 'clipit-connect', expect.stringContaining('popup'))
    await waitFor(() => expect(popup.location.href).toBe('https://zernio.test/connect/youtube'))
    expect(screen.getByText(/finish signing in in the window that opened/i)).toBeTruthy()

    // The sign-in window says "look now"; the account comes from the list.
    api.listSocialAccounts.mockResolvedValue({ configured: true, signInRequired: false, accounts: [TIKTOK, YOUTUBE] })
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'clipit:connect', ok: true, platform: 'youtube' }, origin: window.location.origin }))
    })

    await screen.findByTestId('connected-mark')
    expect(within(screen.getByTestId('channel-youtube')).getByText(/^connected$/i)).toBeTruthy()
    expect(screen.getByRole('switch', { name: /post to youtube shorts/i }).getAttribute('aria-checked')).toBe('true')
    expect(popup.close).toHaveBeenCalled()
  })

  it('is closed when there is no clip to publish', () => {
    render(<PublishDialog clip={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('publish-dialog')).toBeNull()
  })
})
