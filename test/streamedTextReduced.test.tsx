import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StreamedText } from '../components/start/streamed-text'

/**
 * In its own file on purpose: motion reads the reduced-motion preference
 * once per module and keeps it, so a file that has already rendered
 * without the preference cannot be asked again with it.
 */

const prefers = (reduced: boolean) =>
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query, onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }),
  })

afterEach(cleanup)

describe('StreamedText, for someone who asked for less motion', () => {
  it('simply shows the words for anyone who asked for less motion', () => {
    // Codex's finding on #88: MotionConfig stops transforms, not a fade.
    prefers(true)
    render(<StreamedText text="I'll look for that." />)
    const root = screen.getByTestId('streamed-text')
    expect(root.getAttribute('data-still')).toBe('true')
    const first = root.querySelector('span')!
    expect(first.style.opacity).not.toBe('0')
  })
})
