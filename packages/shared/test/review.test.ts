import { describe, expect, it } from 'vitest'
import { REVIEW_INTERVALS_DAYS, answerReview, startReview } from '../src/review'

const now = new Date('2026-11-15T08:00:00Z')
const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86_400_000)

describe('spaced repetition', () => {
  it('starts one day out', () => {
    const r = startReview(now)
    expect(r.step).toBe(0)
    expect(days(r.nextAt)).toBe(1)
  })

  it('moves up one step on "got it"', () => {
    const r = answerReview({ step: 2, lapses: 0 }, true, now)
    expect(r.step).toBe(3)
    expect(days(r.nextAt)).toBe(REVIEW_INTERVALS_DAYS[3])
  })

  it('resets and counts a lapse on "forgot"', () => {
    const r = answerReview({ step: 4, lapses: 1 }, false, now)
    expect(r).toMatchObject({ step: 0, lapses: 2, graduated: false })
    expect(days(r.nextAt)).toBe(1)
  })

  it('graduates after the last step', () => {
    const last = REVIEW_INTERVALS_DAYS.length - 1
    const r = answerReview({ step: last, lapses: 0 }, true, now)
    expect(r.graduated).toBe(true)
    expect(r.step).toBe(last)
  })
})
