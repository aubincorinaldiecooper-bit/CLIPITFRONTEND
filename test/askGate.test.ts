import { describe, expect, it } from 'vitest'
import { askGate } from '../components/start/ask-gate'
import type { Video } from '../lib/types'

/** A question goes as soon as the bytes have landed — and the words about waiting are true of what is waited on. */
const video = (overrides: Partial<Video>): Video => ({ id: 'v1', status: 'ready', readyForSearch: true, ...overrides }) as Video

describe('askGate', () => {
  it('waits for the upload while there is no video yet', () => {
    expect(askGate(null)).toMatchObject({ accepting: false, waitingOn: expect.stringContaining('still uploading') })
  })

  it('takes a question the moment the server says the bytes have landed, however unprepared the video is', () => {
    expect(askGate(video({ status: 'preprocessing', readyForSearch: false, acceptsQuestions: true })).accepting).toBe(true)
    expect(askGate(video({ status: 'pending_upload', readyForSearch: false, acceptsQuestions: false }))).toMatchObject({
      accepting: false,
      waitingOn: expect.stringContaining('still uploading'),
    })
  })

  it('holds an older server to ready-for-search, in the words that are true of it', () => {
    expect(askGate(video({ status: 'preprocessing', readyForSearch: false }))).toMatchObject({
      accepting: false,
      waitingOn: expect.stringContaining('still being prepared'),
    })
    expect(askGate(video({})).accepting).toBe(true)
  })

  it('promises nothing for a video whose preparation failed', () => {
    expect(askGate(video({ status: 'failed', readyForSearch: false, acceptsQuestions: false }))).toEqual({ accepting: false, waitingOn: null, placeholder: null })
  })
})
