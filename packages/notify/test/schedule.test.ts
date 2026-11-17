import { fromLocal } from '@omb/shared'
import { describe, expect, it } from 'vitest'
import { nextDigestAt, occurrences } from '../src/schedule'

const tz = 'Europe/Riga'
const at = (d: number, h: number, mi = 0) =>
  fromLocal({ year: 2026, month: 11, day: d, hour: h, minute: mi }, tz)
const base = { timezone: tz, untilAt: null, rrule: null }

describe('occurrences', () => {
  it('keeps a one-off reminder inside the window', () => {
    const r = { ...base, kind: 'TIME' as const, fireAt: at(18, 9) }
    expect(occurrences(r, at(17, 12), at(24, 12), 50)).toEqual([at(18, 9)])
    expect(occurrences(r, at(18, 10), at(25, 10), 50)).toEqual([])
  })

  it('expands a recurring reminder from the current fire time', () => {
    const r = { ...base, kind: 'RECURRING' as const, fireAt: at(16, 9), rrule: 'FREQ=DAILY' }
    expect(occurrences(r, at(17, 12), at(20, 12), 50)).toEqual([at(18, 9), at(19, 9), at(20, 9)])
  })

  it('stops at UNTIL and at the limit', () => {
    const r = {
      ...base,
      kind: 'RECURRING' as const,
      fireAt: at(18, 9),
      rrule: 'FREQ=DAILY',
      untilAt: at(19, 12),
    }
    expect(occurrences(r, at(17, 12), at(24, 12), 50)).toEqual([at(18, 9), at(19, 9)])
    expect(occurrences({ ...r, untilAt: null }, at(17, 12), at(24, 12), 2)).toHaveLength(2)
  })

  it('skips location reminders', () => {
    const r = { ...base, kind: 'LOCATION' as const, fireAt: null }
    expect(occurrences(r, at(17, 12), at(24, 12), 50)).toEqual([])
  })
})

describe('nextDigestAt', () => {
  const user = { timezone: tz, digestTime: '08:00' }
  it('is today before the digest time and tomorrow after it', () => {
    expect(nextDigestAt(at(17, 7), user)).toEqual(at(17, 8))
    expect(nextDigestAt(at(17, 8), user)).toEqual(at(18, 8))
  })

  it('crosses a month end', () => {
    expect(nextDigestAt(at(30, 23), user)).toEqual(
      fromLocal({ year: 2026, month: 12, day: 1, hour: 8, minute: 0 }, tz),
    )
  })
})
