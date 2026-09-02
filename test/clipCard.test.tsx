import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClipCard, ClipViewer, clipShape, playableUrl } from '../components/clip-card'
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

  it('opens from the picture and not from the menu, which holds the actions as a real menu', async () => {
    const onOpen = vi.fn()
    const rename = vi.fn()
    render(
      <ClipCard
        clip={vertical()}
        onOpen={onOpen}
        actions={[{ label: 'Download', href: 'https://cdn/clip.mp4?download' }, { label: 'Rename', onClick: rename }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Open: The goal/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: /^Actions for/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    const item = await screen.findByRole('menuitem', { name: 'Rename' })
    // Download is a real link that saves the file; nothing routed, nothing scripted.
    const download = screen.getByRole('menuitem', { name: 'Download' })
    expect(download.tagName).toBe('A')
    expect(download.getAttribute('download')).not.toBeNull()
    await userEvent.click(item)
    expect(rename).toHaveBeenCalledTimes(1)
  })

  it('has no menu control when the page gives it no actions', () => {
    render(<ClipCard clip={vertical()} onOpen={() => {}} />)
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull()
  })

  it('cannot open a clip that has no file yet', () => {
    render(<ClipCard clip={clip({ url: null, status: 'generating' })} onOpen={() => {}} />)
    expect((screen.getByRole('button', { name: /^Open:/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  /**
   * The substitution the product rule forbids: a vertical moment whose 9:16
   * file is not finished must not open the wide original in its place. The
   * media block says null, and null means closed.
   */
  it('cannot open a vertical moment whose delivered file is not there, even though the wide cut is', () => {
    const pending = vertical()
    pending.media = { ...pending.media!, url: null, derivativeStatus: 'pending' }
    render(<ClipCard clip={pending} onOpen={() => {}} />)
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

  it('trusts what the server says it delivers before the source size', () => {
    // A vertical delivery whose response carries no media block is still vertical.
    expect(clipShape(clip({ presentation: 'vertical', sourceWidth: 1920, sourceHeight: 1080 }))).toBe('9:16')
    expect(clipShape(clip({ presentation: 'original', sourceWidth: 1920, sourceHeight: 1080 }))).toBe('16:9')
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

  it('plays the delivered vertical file for a vertical moment, never the wide original', () => {
    render(<ClipViewer clip={vertical()} onClose={() => {}} />)
    expect(document.querySelector('video')!.getAttribute('src')).toBe('https://cdn/vertical.mp4')
  })

  it('plays the canonical file only for an older response with no media block', () => {
    expect(playableUrl(clip())).toBe('https://cdn/clip.mp4')
    expect(playableUrl(vertical())).toBe('https://cdn/vertical.mp4')
    const pending = vertical()
    pending.media = { ...pending.media!, url: null, derivativeStatus: 'pending' }
    expect(playableUrl(pending)).toBeNull()
  })

  it('lays the actions along the bottom as buttons, with Download still a real link', () => {
    render(
      <ClipViewer
        clip={wide()}
        onClose={() => {}}
        actions={[{ label: 'Download', href: 'https://cdn/clip.mp4?download' }, { label: 'Delete', tone: 'danger', onClick: () => {} }]}
      />,
    )
    const download = screen.getByRole('link', { name: 'Download' })
    expect(download.getAttribute('download')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
  })

  it('shows nothing when no clip is open', () => {
    render(<ClipViewer clip={null} onClose={() => {}} />)
    expect(document.querySelector('video')).toBeNull()
  })
})
