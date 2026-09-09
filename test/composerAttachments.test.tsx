import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useAttachments } from '../components/start/composer-attachments'

/**
 * Holding the pictures someone attaches to a question.
 *
 * Every case here is a bug Devin found on #90 or one the owner's draft
 * shipped, so each should fail if the fix is undone.
 */

let handed = 0
const released: string[] = []

beforeEach(() => {
  handed = 0
  released.length = 0
  // jsdom has neither, and the whole point of these tests is who releases what.
  URL.createObjectURL = vi.fn(() => `blob:picture-${(handed += 1)}`)
  URL.revokeObjectURL = vi.fn((url: string) => {
    released.push(url)
  })
})

afterEach(cleanup)

const picture = (name: string) => new File(['bytes'], name, { type: 'image/png', lastModified: 1 })

describe('the pictures attached to a question', () => {
  it('gives the same file picked twice two separate identities', () => {
    // The picker deliberately allows re-picking, and the draft keyed on the
    // file's name, date and size — so both copies were one attachment.
    const { result } = renderHook(() => useAttachments(6))
    const same = picture('harbour.png')

    act(() => result.current.add([same]))
    act(() => result.current.add([same]))

    expect(result.current.attachments).toHaveLength(2)
    const [first, second] = result.current.attachments
    expect(first.id).not.toBe(second.id)
    expect(first.url).not.toBe(second.url)
  })

  it('removes only the copy asked for, and releases only its picture', () => {
    const { result } = renderHook(() => useAttachments(6))
    const same = picture('harbour.png')
    act(() => result.current.add([same]))
    act(() => result.current.add([same]))

    const [first, second] = result.current.attachments
    act(() => result.current.remove(first.id))

    expect(result.current.attachments.map((a) => a.id)).toEqual([second.id])
    expect(released).toEqual([first.url])
  })

  it('does not hold a picture beyond the limit, nor make one for it', () => {
    const { result } = renderHook(() => useAttachments(2))
    act(() => result.current.add([picture('a.png'), picture('b.png'), picture('c.png')]))

    expect(result.current.attachments).toHaveLength(2)
    // The third never became an object URL, so there is nothing to leak.
    expect(handed).toBe(2)
  })

  it('ignores anything that is not a picture', () => {
    const { result } = renderHook(() => useAttachments(6))
    const clip = new File(['bytes'], 'harbour.mp4', { type: 'video/mp4', lastModified: 1 })
    act(() => result.current.add([clip, picture('a.png')]))

    expect(result.current.attachments.map((a) => a.name)).toEqual(['a.png'])
  })

  it('releases every picture still held when the screen goes', () => {
    const { result, unmount } = renderHook(() => useAttachments(6))
    act(() => result.current.add([picture('a.png'), picture('b.png')]))
    const held = result.current.attachments.map((a) => a.url)

    unmount()

    expect(released.sort()).toEqual(held.sort())
  })
})
