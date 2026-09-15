import { describe, expect, it } from 'vitest'
import { askAboutVideoGate, askGate, askTarget } from '../components/start/ask-gate'
import type { Video } from '../lib/types'

/** A question goes as soon as the bytes have landed — and the words about waiting are true of what is waited on. */
const video = (overrides: Partial<Video>): Video => ({ id: 'v1', status: 'ready', readyForSearch: true, ...overrides }) as Video

describe('askGate', () => {
  it('takes a question for the internet when nothing is attached', () => {
    // Words alone are enough: there is no file to wait for.
    expect(askGate(null)).toEqual({ accepting: true, waitingOn: null, placeholder: null })
    expect(askTarget(null)).toBe('internet')
  })

  it('waits for a file that was picked, rather than searching the web instead', () => {
    // Someone who just picked a video meant to ask about that video.
    expect(askGate(null, { attaching: true })).toMatchObject({
      accepting: false,
      waitingOn: expect.stringContaining('still uploading'),
    })
    expect(askTarget(null, { attaching: true })).toBe('video')
  })

  it('asks about the video once one is attached', () => {
    expect(askTarget(video({}))).toBe('video')
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

  it('never takes "nothing attached" for the internet in a box that is about a video', () => {
    // The follow-up under the results, and the box on the moment page, are
    // asking about one video. No video there is a fault, not a web search.
    expect(askAboutVideoGate(null)).toMatchObject({
      accepting: false,
      waitingOn: expect.stringContaining('still uploading'),
    })
  })
})
