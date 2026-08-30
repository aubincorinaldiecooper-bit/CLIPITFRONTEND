import { describe, expect, it } from 'vitest'
import { normalizeEvaluationReport } from '../lib/api'
import type { EvaluationReport } from '../lib/types'

/**
 * The paired rollout must not depend on merge order: an old-schema backend
 * answer (thumbs language) renders correctly through the new page, and a
 * new-schema answer passes through untouched.
 */

describe('normalizeEvaluationReport', () => {
  it('maps the legacy thumbs schema onto Keep/Skip fields', () => {
    const raw = {
      quality: { momentsReturned: 10, momentsWithFeedback: 4, thumbsUp: 3, thumbsDown: 1, thumbsUpRate: 0.75, thumbsDownRate: 0.25 },
      boundaries: {
        eligibleReviewedMoments: 4,
        firstPassSuccesses: 2,
        firstPassSuccessRate: 0.5,
        reviewedReclips: 2,
        acceptedReclips: 1,
        reclipAcceptanceRate: 0.5,
        timingDownvotes: 1,
        timingDownvoteRate: 0.25,
      },
    } as unknown as EvaluationReport & Record<string, unknown>

    const report = normalizeEvaluationReport(raw)
    expect(report.quality.keeps).toBe(3)
    expect(report.quality.skips).toBe(1)
    expect(report.quality.keepRate).toBe(0.75)
    expect(report.quality.skipRate).toBe(0.25)
    expect(report.boundaries.firstPassKeeps).toBe(2)
    expect(report.boundaries.firstPassKeepRate).toBe(0.5)
    expect(report.boundaries.keptReclips).toBe(1)
    expect(report.boundaries.reclipKeepRate).toBe(0.5)
    expect(report.boundaries.timingIssues).toBe(1)
    expect(report.boundaries.timingIssueRate).toBe(0.25)
  })

  it('passes the new schema through untouched — including honest nulls', () => {
    const raw = {
      quality: { momentsReturned: 0, momentsWithFeedback: 0, keeps: 0, skips: 0, keepRate: null, skipRate: null },
      boundaries: { eligibleReviewedMoments: 0, firstPassKeeps: 0, firstPassKeepRate: null, keptReclips: 0, reclipKeepRate: null, timingIssues: 0, timingIssueRate: null },
    } as unknown as EvaluationReport & Record<string, unknown>

    const report = normalizeEvaluationReport(raw)
    // A null rate is an honest "nobody has decided yet" — it must survive,
    // never be replaced by a legacy lookup that would leave undefined.
    expect(report.quality.keepRate).toBeNull()
    expect(report.boundaries.firstPassKeepRate).toBeNull()
    expect(report.quality.keeps).toBe(0)
  })
})
