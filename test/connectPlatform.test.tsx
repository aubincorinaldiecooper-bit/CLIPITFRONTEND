import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

/**
 * Connecting a channel from inside the publish screens: the sign-in window
 * is opened inside the click and addressed once the server has minted the
 * URL — and a screen left before that address arrives opens nothing.
 */

const api = {
  listSocialAccounts: vi.fn(async () => ({ configured: true, signInRequired: false, accounts: [] })),
  getConnectUrl: vi.fn(),
}
vi.mock('@/lib/api', () => ({ api, ApiError: class ApiError extends Error {} }))

const { useConnectPlatform } = await import('../components/theater/connect-platform')

afterEach(() => vi.clearAllMocks())

describe('useConnectPlatform', () => {
  it('a screen left before the sign-in was addressed closes the window it held and sends nobody anywhere', async () => {
    // Codex's finding on #77: the pending connect resumed after the screen
    // was gone, navigated the window — or the tab, when windows were
    // blocked — although the person had backed out.
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    Object.defineProperty(window, 'open', { configurable: true, writable: true, value: vi.fn(() => popup) })
    let deliver: (value: { platform: string; url: string }) => void = () => undefined
    api.getConnectUrl.mockReturnValue(new Promise((resolve) => { deliver = resolve }))

    const { result, unmount } = renderHook(() => useConnectPlatform({ onConnected: vi.fn() }))
    act(() => { void result.current.connect('youtube', []) })
    expect(window.open).toHaveBeenCalledWith('about:blank', 'clipit-connect', expect.stringContaining('popup'))

    unmount()
    await act(async () => { deliver({ platform: 'youtube', url: 'https://zernio.test/connect/youtube' }) })

    expect(popup.close).toHaveBeenCalled()
    expect(popup.location.href).toBe('')
  })

  it('addresses the window it opened once the URL is minted, and asks the list one ask at a time', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    Object.defineProperty(window, 'open', { configurable: true, writable: true, value: vi.fn(() => popup) })
    api.getConnectUrl.mockResolvedValue({ platform: 'x', url: 'https://zernio.test/connect/x' })
    api.listSocialAccounts.mockReturnValue(new Promise(() => undefined))
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      const { result } = renderHook(() => useConnectPlatform({ onConnected: vi.fn() }))
      await act(async () => { await result.current.connect('x', []) })
      expect(popup.location.href).toBe('https://zernio.test/connect/x')
      expect(result.current.state).toMatchObject({ platform: 'x', phase: 'waiting' })
      await act(async () => { await vi.advanceTimersByTimeAsync(7_600) })
      // Three ticks passed; the first ask never answered, and no second one joined it.
      expect(api.listSocialAccounts).toHaveBeenCalledTimes(1)
      expect(api.listSocialAccounts).toHaveBeenCalledWith(expect.any(Number))
    } finally {
      vi.useRealTimers()
    }
  })
})
