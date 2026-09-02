import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ClipCard, ClipMenuItem, ClipViewer, clipShape } from '../components/clip-card'
import type { LibraryClip } from '../lib/types'

/**
 * The card after the owner's reference: poster on top, a shape pill and one
 * round control over it, the title and two quiet lines under it. Every card
 * is the same tall box; opening a clip plays it in its own shape.
 */

const clip = (over: Partial<LibraryClip> = {}): LibraryClip => ({
  id: 'clip-1',
  videoId: 'video-1',
  clipMatchId: 'match-1',
  status: 'ready',
  error: null,
  startSeconds: 10,
  endSeconds: 30,
  startTimecode: '0:10',
  endTimecode: '0:30',
  durationSeconds: 20,
  sizeBytes: 1000,
  url: 'https://cdn/clip.mp4',
  downloadUrl: 'https://cdn/clip.mp4?download',
  urlExpiresAt: null,
  createdAt: '2026-09-02T10:00:00Z',
  description: 'The goal from the corner',
  thumbnailUrl: 'https://cdn/thumb.jpg',
  videoTitle: 'Sunday five-a-side',
  ...over,
})

const vertical = () =>
  clip({
    media: {
      composition: { aspectRatio: '9:16', mode: 'smart_crop', focalX: 0.75, focalY: 0.5, focusPct: 75, crop: { x: 0.59, y: 0, width: 0.32, height: 1 } },
      url: 'https://cdn/vertical.mp4',
      canonicalUrl: 'https://cdn/clip.mp4',
      posterUrl: 'https://cdn/poster.jpg',
      posterTimestampSeconds: 5,
      sourceAspectRatio: '16:9',
      outputAspectRatio: '9:16',
      compositionMode: 'smart_crop',
      derivativeStatus: 'ready',
    },
  })

const wide = () =>
  clip({
    media: {
      composition: { aspectRatio: '16:9', mode: 'original', focalX: null, focalY: null, focusPct: 50, crop: null },
      url: 'https://cdn/clip.mp4',
      canonicalUrl: 'https://cdn/clip.mp4',
      posterUrl: 'https://cdn/poster-wide.jpg',
      posterTimestampSeconds: 5,
      sourceAspectRatio: '16:9',
      outputAspectRatio: '16:9',
      compositionMode: 'original',
      derivativeStatus: null,
    },
  })

afterEach(cleanup)

describe('the clip card', () => {
  it("names the shape, the runtime, the video and the day, and shows the render's own poster", () => {
    render(<ClipCard clip={vertical()} onOpen={() => {}} showDate />)
    expect(screen.getByText('9:16')).toBeTruthy()
    expect(screen.getByText('0:20')).toBeTruthy()
    expect(screen.getByText('Sunday five-a-side')).toBeTruthy()
    expect(screen.getByText(/^Cut /)).toBeTruthy()
    expect(document.querySelector('img')!.getAttribute('src')).toBe('https://cdn/poster.jpg')
  })

  it('says a wide clip is wide, and shows the middle of its frame in the tall box', () => {
    render(<ClipCard clip={wide()} onOpen={() => {}} />)
    expect(screen.getByText('16:9')).toBeTruthy()
    // Centred: the sides are what the tall box cuts, evenly.
    expect(document.querySelector('img')!.style.objectPosition).toBe('50% 50%')
  })

  it('opens from the picture and not from the menu, which holds the actions', async () => {
    const onOpen = vi.fn()
    render(<ClipCard clip={vertical()} onOpen={onOpen} actions={<ClipMenuItem label="Rename" />} />)
    fireEvent.click(screen.getByRole('button', { name: /^Open: The goal/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /^Actions for/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Rename')).toBeTruthy()
  })

  it('has no menu control when the page gives it no actions', () => {
    render(<ClipCard clip={vertical()} onOpen={() => {}} />)
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull()
  })

  it('cannot open a clip that has no file yet', () => {
    render(<ClipCard clip={clip({ url: null, status: 'generating' })} onOpen={() => {}} />)
    expect((screen.getByRole('button', { name: /^Open:/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('falls back to the search still when no poster was rendered', () => {
    render(<ClipCard clip={clip()} onOpen={() => {}} />)
    expect(document.querySelector('img')!.getAttribute('src')).toBe('https://cdn/thumb.jpg')
  })
})

describe('the shape a card names', () => {
  it('is the delivered shape from the media block', () => {
    expect(clipShape(vertical())).toBe('9:16')
    expect(clipShape(wide())).toBe('16:9')
  })

  it('falls back to the source size, then to wide', () => {
    expect(clipShape(clip({ sourceWidth: 1080, sourceHeight: 1920 }))).toBe('9:16')
    // A pixel off a named shape is still that shape to a person.
    expect(clipShape(clip({ sourceWidth: 1919, sourceHeight: 1080 }))).toBe('16:9')
    expect(clipShape(clip({ sourceWidth: 1080, sourceHeight: 1080 }))).toBe('1:1')
    expect(clipShape(clip())).toBe('16:9')
  })
})

describe('the viewer', () => {
  it('plays the file, with its poster, when a clip is open', () => {
    render(<ClipViewer clip={wide()} onClose={() => {}} showDate />)
    const video = document.querySelector('video')!
    expect(video.getAttribute('src')).toBe('https://cdn/clip.mp4')
    expect(video.getAttribute('poster')).toBe('https://cdn/poster-wide.jpg')
    // Named for the screen reader in the dialog's description and for the eye below the video.
    expect(screen.getAllByText(/Sunday five-a-side/).length).toBeGreaterThan(0)
  })

  it('plays the vertical file for a vertical moment, never the wide original', () => {
    render(<ClipViewer clip={vertical()} onClose={() => {}} />)
    expect(document.querySelector('video')!.getAttribute('src')).toBe('https://cdn/clip.mp4')
  })

  it('shows nothing when no clip is open', () => {
    render(<ClipViewer clip={null} onClose={() => {}} />)
    expect(document.querySelector('video')).toBeNull()
  })
})
