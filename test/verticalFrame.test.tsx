import { describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { VerticalFrame, VERTICAL_RATIO } from '../components/media/vertical-frame'
import { astryxRatio } from './support/astryxRatio'

/**
 * The frame is Astryx's, not ours. These tests hold the two things that
 * would silently go wrong: the ratio drifting away from the 9:16 the backend
 * actually renders, and a landscape source being cropped to fill a vertical
 * box — which throws away the sides of a frame nobody chose to cut.
 */

describe('VerticalFrame — Astryx AspectRatio at the canonical ratio', () => {
  it('is 9:16, the same shape the backend encodes', () => {
    expect(VERTICAL_RATIO).toBeCloseTo(9 / 16, 6)
  })

  it('applies the ratio as a real CSS aspect-ratio, not a padding hack', () => {
    cleanup()
    const { container } = render(
      <VerticalFrame>
        <span data-testid="child">clip</span>
      </VerticalFrame>,
    )
    const root = container.firstElementChild as HTMLElement
    // Astryx sets aspectRatio inline from the `ratio` prop. jsdom normalises
    // a bare number to "<n> / 1", which is the same ratio — assert the value
    // rather than the spelling.
    const ratio = astryxRatio(root)
    expect(ratio).toBeCloseTo(9 / 16, 6)
    expect(screen.getByTestId('child')).toBeTruthy()
  })

  it('covers for real vertical media — the file is already 9:16, nothing to crop', () => {
    cleanup()
    const { container } = render(
      <VerticalFrame isVertical>
        <span>vertical</span>
      </VerticalFrame>,
    )
    expect(container.querySelector('[data-astryx-aspect-ratio-override="cover"]')).toBeTruthy()
  })

  it('CONTAINS a landscape source rather than cropping its sides away', () => {
    cleanup()
    const { container } = render(
      <VerticalFrame isVertical={false}>
        <span>landscape</span>
      </VerticalFrame>,
    )
    // contain, never cover: cropping here would discard frame the backend
    // deliberately preserved with its blurred-background composition.
    expect(container.querySelector('[data-astryx-aspect-ratio-override="contain"]')).toBeTruthy()
    expect(container.querySelector('[data-astryx-aspect-ratio-override="cover"]')).toBeNull()
  })
})
