import { describe, expect, it } from 'vitest'
import { downloadUrlOf, needsKeep, productionOf, publishableFor } from '../components/start/production'
import type { Exchange } from '../components/start/types'
import type { Clip } from '../lib/types'

/**
 * Keep is production. Between the press and the file there is a state the
 * card, the dialogue and the publish screens all read from one place, and
 * "produced" is never said of a vertical moment whose 9:16 file is not there.
 */

const clip = (overrides: Partial<Clip> = {}): Clip =>
  ({ id: 'c-1', clipMatchId: 'm-1', status: 'ready', url: 'https://cdn/c-1.mp4', downloadUrl: 'https://cdn/c-1.mp4?download=1', media: null, ...overrides }) as Clip

const vertical = (derivativeStatus: 'pending' | 'ready' | 'failed', downloadUrl: string | null = null) =>
  ({
    composition: { aspectRatio: '9:16', mode: 'smart_crop', focalX: 0.5, focalY: 0.5, focusPct: 50, crop: null },
    url: derivativeStatus === 'ready' ? 'https://cdn/c-1-vertical.mp4' : null,
    downloadUrl,
    canonicalUrl: 'https://cdn/c-1.mp4',
    posterUrl: null,
    posterTimestampSeconds: null,
    sourceAspectRatio: '16:9',
    outputAspectRatio: '9:16',
    compositionMode: 'smart_crop',
    derivativeStatus,
  }) as Clip['media']

describe('productionOf', () => {
  it('is null for a moment nothing was asked for', () => {
    expect(productionOf(null)).toBeNull()
    expect(productionOf(null, null)).toBeNull()
  })

  it('reads the match\'s own note of a clip before the row has arrived', () => {
    expect(productionOf(null, { id: 'c-1', status: 'pending' } as never)).toBe('producing')
    expect(productionOf(null, { id: 'c-1', status: 'failed' } as never)).toBe('failed')
  })

  it('follows the cut, then the 9:16 file', () => {
    expect(productionOf(clip({ status: 'pending', url: null }))).toBe('producing')
    expect(productionOf(clip({ status: 'generating', url: null }))).toBe('producing')
    expect(productionOf(clip({ status: 'failed', url: null }))).toBe('failed')
    // The landscape cut is ready long before the vertical file: still producing.
    expect(productionOf(clip({ media: vertical('pending') }))).toBe('producing')
    expect(productionOf(clip({ media: vertical('failed') }))).toBe('failed')
    expect(productionOf(clip({ media: vertical('ready') }))).toBe('produced')
  })

  it('a clip cut before the always-vertical rule is produced as it is', () => {
    expect(productionOf(clip())).toBe('produced')
  })
})

describe('needsKeep — whether Publish must keep the moment first', () => {
  it('keeps a moment not yet kept, and one kept without a clip', () => {
    expect(needsKeep({ feedback: null, clip: null }, null)).toBe(true)
    expect(needsKeep({ feedback: 'approved', clip: null }, null)).toBe(true)
  })

  it('keeps AGAIN a kept moment whose cut failed, so the server makes it again', () => {
    // Devin's and Codex's finding on #87: a failed cut had no working retry.
    expect(needsKeep({ feedback: 'approved', clip: { id: 'c-1', status: 'failed' } as never }, clip({ status: 'failed', url: null }))).toBe(true)
    expect(needsKeep({ feedback: 'approved', clip: { id: 'c-1', status: 'ready' } as never }, clip({ media: vertical('failed') }))).toBe(true)
  })

  it('goes straight to publishing when the clip exists or is on its way', () => {
    expect(needsKeep({ feedback: 'approved', clip: { id: 'c-1', status: 'ready' } as never }, clip({ media: vertical('ready') }))).toBe(false)
    expect(needsKeep({ feedback: 'approved', clip: { id: 'c-1', status: 'pending' } as never }, clip({ status: 'pending', url: null }))).toBe(false)
  })
})

describe('downloadUrlOf — the file offered to save is the file on screen', () => {
  it('offers the 9:16 file, signed to be saved, and nothing before it exists', () => {
    expect(downloadUrlOf(clip({ media: vertical('pending') }))).toBeNull()
    expect(downloadUrlOf(clip({ media: vertical('ready', 'https://cdn/c-1-vertical.mp4?download=1') }))).toBe('https://cdn/c-1-vertical.mp4?download=1')
  })

  it('never falls back to the landscape cut for a vertical moment', () => {
    // A server that signs nothing for saving offers nothing.
    expect(downloadUrlOf(clip({ media: vertical('ready') }))).toBeNull()
  })

  it('offers an old landscape clip as it is', () => {
    expect(downloadUrlOf(clip())).toBe('https://cdn/c-1.mp4?download=1')
  })
})

describe('publishableFor — the dialog reads readiness from the conversation', () => {
  const exchanges = (media: Clip['media']): Exchange[] => [
    {
      request: { id: 'r1', matches: [{ id: 'm-1', description: 'The dunk', clip: { id: 'c-1', status: 'ready' } }] } as never,
      clips: [clip({ media })],
    },
  ]

  it('is not ready until the 9:16 file is there, then is', () => {
    expect(publishableFor(exchanges(vertical('pending')), 'c-1', 'fallback')).toEqual({ id: 'c-1', title: 'The dunk', ready: false })
    expect(publishableFor(exchanges(vertical('ready')), 'c-1', 'fallback')).toEqual({ id: 'c-1', title: 'The dunk', ready: true })
  })

  it('knows the clip from the match alone, before its row has been fetched', () => {
    const early: Exchange[] = [{ request: { id: 'r1', matches: [{ id: 'm-1', description: 'The dunk', clip: { id: 'c-1', status: 'pending' } }] } as never, clips: [] }]
    expect(publishableFor(early, 'c-1', 'fallback')).toEqual({ id: 'c-1', title: 'The dunk', ready: false })
  })

  it('falls back to the title it was given when the clip is not in the conversation', () => {
    expect(publishableFor([], 'c-9', 'A moment from your video')).toEqual({ id: 'c-9', title: 'A moment from your video', ready: false })
  })
})
