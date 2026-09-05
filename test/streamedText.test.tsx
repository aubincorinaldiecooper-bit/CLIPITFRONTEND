import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StreamedText } from '../components/start/streamed-text'

/** The words are all there from the first render; only their arrival is staggered, and not for everyone. */

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

describe('StreamedText', () => {
  it('renders the whole sentence at once, word by word', () => {
    prefers(false)
    render(<StreamedText text="I'll look for that." />)
    expect(screen.getByTestId('streamed-text').textContent).toBe("I'll look for that.")
    // Each word starts unseen and fades in on its own beat.
    const first = screen.getByTestId('streamed-text').querySelector('span')!
    expect(first.style.opacity).toBe('0')
  })

})
