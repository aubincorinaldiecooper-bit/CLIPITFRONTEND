import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Publishing one moment from the feed: the owner's "Where do they go?"
 * screens in a dialog, for the clip the card's Publish pressed on.
 */

const api = {
  listSocialAccounts: vi.fn(async () => ({
    configured: true,
    signInRequired: false,
    accounts: [{ id: 'acc-1', platform: 'tiktok', displayName: '@clipit', status: 'connected' }],
  })),
  publishClip: vi.fn(async () => ({ posts: [{ id: 'p1', status: 'submitted', aspect: '9:16', targets: [{ platform: 'tiktok' }] }] })),
}
vi.mock('@/lib/api', () => ({ api, ApiError: class ApiError extends Error {} }))

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

afterEach(cleanup)

describe('PublishDialog', () => {
  it('opens on "Where do they go?" for the clip, and Post now reports what happened', async () => {
    const onClose = vi.fn()
    render(<PublishDialog clip={{ id: 'c-a', title: 'The goal from the corner', ready: true }} onClose={onClose} />)
    expect(screen.getByTestId('publish-dialog')).toBeTruthy()
    await waitFor(() => expect(api.listSocialAccounts).toHaveBeenCalled())
    await screen.findByText(/@clipit/)

    await userEvent.click(await screen.findByRole('button', { name: /post now/i }))

    await waitFor(() => expect(api.publishClip).toHaveBeenCalledWith('c-a', expect.objectContaining({ accountIds: ['acc-1'] })))
    expect(await screen.findByText(/on their way/i)).toBeTruthy()
  })

  it('is closed when there is no clip to publish', () => {
    render(<PublishDialog clip={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('publish-dialog')).toBeNull()
  })
})
