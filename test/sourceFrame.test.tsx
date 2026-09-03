import { describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SourceFrame } from '../components/media/source-frame'

/**
 * The frame the original video plays in.
 *
 * The stage used to be a fixed 16:9 box. A phone video held upright played
 * the right way up inside it, but with black bars down both sides and a wide
 * frame around it — which reads, correctly, as "my video is being shown in
 * landscape". Nothing was ever rotated; the box was the wrong shape and the
 * footage had to fit inside it.
 *
 * So the thing to hold here is that the box takes its shape from the video,
 * and that an upright video is sized from its height rather than running off
 * the bottom of the screen.
 */

/** Astryx sets aspectRatio inline; jsdom normalises a bare number to "n / 1". */
function ratioOf(root: HTMLElement): number {
  const [w, h] = root.style.aspectRatio.split('/').map((part) => Number(part.trim()))
  return w / (h || 1)
}

function frame(width: number | null | undefined, height: number | null | undefined) {
  cleanup()
  const { container } = render(
    <SourceFrame width={width} height={height}>
      <span data-testid="child">video</span>
    </SourceFrame>,
  )
  return container.firstElementChild as HTMLElement
}

describe('SourceFrame — the box is the shape of the video', () => {
  it('is upright for an upright video, which is the whole point', () => {
    const root = frame(1080, 1920)
    expect(ratioOf(root)).toBeCloseTo(9 / 16, 6)
    // The bug this replaces: a 16:9 box for a 9:16 file.
    expect(ratioOf(root)).not.toBeCloseTo(16 / 9, 2)
    expect(screen.getByTestId('child')).toBeTruthy()
  })

  it('is wide for a wide video', () => {
    expect(ratioOf(frame(1920, 1080))).toBeCloseTo(16 / 9, 6)
  })

  it('follows an unusual shape rather than rounding it to something familiar', () => {
    // Ultra-wide, square, and a tall crop all get their own shape.
    expect(ratioOf(frame(2560, 1080))).toBeCloseTo(2560 / 1080, 6)
    expect(ratioOf(frame(1000, 1000))).toBeCloseTo(1, 6)
    expect(ratioOf(frame(720, 1280))).toBeCloseTo(720 / 1280, 6)
  })

  it('sizes an upright video from its height, so it fits on the screen', () => {
    // The box takes its width from the stage, so a 9:16 video at full width
    // would be nearly twice the height of the viewport. Capping the height
    // only works if the width is released to follow it — a cap on its own
    // would clamp the box off ratio and squash the picture, which is why
    // both classes are asserted rather than just the cap.
    const root = frame(1080, 1920)
    expect(root.style.maxHeight).toBe('70svh')
    // Both, or neither. A rendered check with only the cap gave a box of
    // 479x665 for a 1080x1920 video — clamped, off ratio, picture squashed.
    // With the width released it is 374x665, which is the ratio exactly.
    expect(root.style.width).toBe('auto')
    // The ratio still wins: AspectRatio applies it after this style.
    expect(ratioOf(root)).toBeCloseTo(9 / 16, 6)
  })

  it('leaves a wide video to fill the stage', () => {
    const root = frame(1920, 1080)
    expect(root.style.maxHeight).toBeFalsy()
    expect(root.style.width).toBeFalsy()
  })

  it('falls back to 16:9 while the video has not been measured yet', () => {
    // The stage renders before the upload has been probed. A box that
    // resizes once is better than one that starts as an arbitrary square.
    expect(ratioOf(frame(null, null))).toBeCloseTo(16 / 9, 6)
    expect(ratioOf(frame(undefined, undefined))).toBeCloseTo(16 / 9, 6)
  })

  it('does not divide by a zero it was handed', () => {
    // A row written before probing, or a probe that failed, can carry zeros.
    // NaN or Infinity here would collapse the stage entirely.
    expect(ratioOf(frame(0, 0))).toBeCloseTo(16 / 9, 6)
    expect(ratioOf(frame(1920, 0))).toBeCloseTo(16 / 9, 6)
    expect(ratioOf(frame(0, 1080))).toBeCloseTo(16 / 9, 6)
  })
})
