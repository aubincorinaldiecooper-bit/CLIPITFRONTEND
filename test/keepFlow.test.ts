import { describe, expect, it, vi } from 'vitest'
import { oneAtATime, runKeep } from '../components/start/keep-flow'
import type { Clip } from '../lib/types'

/**
 * A Keep approves, then makes; a failure puts back only what the press
 * made, waits for that, and never lets an older press overtake a newer one.
 */
const clip = { id: 'c-1', clipMatchId: 'm-1', status: 'pending' } as Clip
const undecided = { verdict: null, reason: null }
const kept = { verdict: 'approved' as const, reason: null }

const effects = () => ({
  approve: vi.fn(async () => undefined),
  produce: vi.fn(async () => clip),
  rollback: vi.fn(async () => undefined),
  show: vi.fn(),
  pending: { set: vi.fn(), delete: vi.fn() },
  isCurrent: vi.fn(() => true),
  fail: vi.fn(),
})

describe('runKeep', () => {
  it('approves, then makes, and hands back the clip', async () => {
    const e = effects()
    await expect(runKeep(undecided, e)).resolves.toBe(clip)
    expect(e.show).toHaveBeenCalledWith({ verdict: 'approved', reason: null })
    expect(e.approve.mock.invocationCallOrder[0]!).toBeLessThan(e.produce.mock.invocationCallOrder[0]!)
    expect(e.rollback).not.toHaveBeenCalled()
  })

  it('an approval that failed shows the moment as it was, and pends nothing', async () => {
    const e = effects()
    e.approve.mockRejectedValueOnce(new Error('refused'))
    await expect(runKeep(undecided, e)).resolves.toBeNull()
    expect(e.show).toHaveBeenLastCalledWith({ verdict: null, reason: null })
    expect(e.pending.delete).toHaveBeenCalled()
    expect(e.fail).toHaveBeenCalled()
  })

  it('a cut that did not start after a first Keep takes the approval back on the server — and waits for that', async () => {
    // Devin's finding on #88: fired and forgotten, the rollback could land
    // after a retry's approval and leave the card and the server apart.
    const e = effects()
    e.produce.mockRejectedValueOnce(new Error('queue down'))
    let release: () => void = () => {}
    e.rollback.mockImplementation(() => new Promise<void>((resolve) => { release = resolve }))
    let settled = false
    const run = runKeep(undecided, e).then((result) => { settled = true; return result })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(e.rollback).toHaveBeenCalledWith({ verdict: null, reason: null })
    expect(e.pending.set).toHaveBeenLastCalledWith({ verdict: null, reason: null })
    expect(settled).toBe(false)
    release()
    await expect(run).resolves.toBeNull()
    expect(settled).toBe(true)
  })

  it('a rollback that failed pends nothing, so the poll shows what the server holds', async () => {
    const e = effects()
    e.produce.mockRejectedValueOnce(new Error('queue down'))
    e.rollback.mockRejectedValueOnce(new Error('offline'))
    await expect(runKeep(undecided, e)).resolves.toBeNull()
    expect(e.pending.delete).toHaveBeenCalled()
  })

  it('a Keep again on a kept moment rolls nothing back and leaves it kept', async () => {
    const e = effects()
    e.produce.mockRejectedValueOnce(new Error('queue down'))
    await expect(runKeep(kept, e)).resolves.toBeNull()
    expect(e.rollback).not.toHaveBeenCalled()
    expect(e.show).toHaveBeenLastCalledWith({ verdict: 'approved', reason: null })
    expect(e.pending.delete).toHaveBeenCalled()
  })

  it('a press that is no longer the live one touches nothing', async () => {
    const e = effects()
    e.isCurrent.mockReturnValue(false)
    e.produce.mockRejectedValueOnce(new Error('queue down'))
    await expect(runKeep(undecided, e)).resolves.toBeNull()
    expect(e.rollback).not.toHaveBeenCalled()
    expect(e.fail).not.toHaveBeenCalled()
  })
})

describe('oneAtATime', () => {
  it('runs presses on the same moment in order, the second only after the first has settled, failures included', async () => {
    const queue = new Map<string, Promise<unknown>>()
    const order: string[] = []
    let releaseFirst: () => void = () => {}
    const first = oneAtATime(queue, 'm-1', () => new Promise<string>((_resolve, reject) => {
      order.push('first started')
      releaseFirst = () => reject(new Error('first failed'))
    }))
    const second = oneAtATime(queue, 'm-1', async () => {
      order.push('second started')
      return 'done'
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(order).toEqual(['first started'])
    releaseFirst()
    await expect(first).rejects.toThrow('first failed')
    await expect(second).resolves.toBe('done')
    expect(order).toEqual(['first started', 'second started'])
  })

  it('does not hold presses on different moments behind each other', async () => {
    const queue = new Map<string, Promise<unknown>>()
    oneAtATime(queue, 'm-1', () => new Promise(() => {}))
    await expect(oneAtATime(queue, 'm-2', async () => 'free')).resolves.toBe('free')
  })
})
