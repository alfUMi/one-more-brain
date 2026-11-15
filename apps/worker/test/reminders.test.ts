import { fromLocal, toLocal } from '@omb/shared'
import { describe, expect, it } from 'vitest'
import { advance, type DueReminder } from '../src/reminders'

const tz = 'Europe/Berlin'
const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  fromLocal({ year: y, month: mo, day: d, hour: h, minute: mi }, tz)
const local = (d: Date) => {
  const l = toLocal(d, tz)
  return `${l.year}-${l.month}-${l.day} ${l.hour}:${String(l.minute).padStart(2, '0')}`
}

const base: DueReminder = {
  id: 'r',
  kind: 'TIME',
  fireAt: at(2026, 11, 16, 18),
  rrule: null,
  timezone: tz,
  untilAt: null,
}

describe('advance', () => {
  it('marks one-off reminders fired', () => {
    expect(advance(base, at(2026, 11, 16, 18, 1))).toEqual({ status: 'FIRED', fireAt: base.fireAt })
  })

  it('moves a daily reminder to tomorrow', () => {
    const r = { ...base, kind: 'RECURRING' as const, rrule: 'FREQ=DAILY;BYHOUR=18;BYMINUTE=0' }
    const next = advance(r, at(2026, 11, 16, 18, 0))
    expect(next.status).toBe('ACTIVE')
    expect(local(next.fireAt)).toBe('2026-11-17 18:00')
  })

  it('skips occurrences missed while the worker was down', () => {
    const r = { ...base, kind: 'RECURRING' as const, rrule: 'FREQ=DAILY;BYHOUR=18;BYMINUTE=0' }
    const next = advance(r, at(2026, 11, 20, 9))
    expect(local(next.fireAt)).toBe('2026-11-20 18:00')
  })

  it('keeps monthly reminders on their day', () => {
    const r = {
      ...base,
      kind: 'RECURRING' as const,
      fireAt: at(2026, 12, 1, 9),
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0',
    }
    expect(local(advance(r, at(2026, 12, 1, 9)).fireAt)).toBe('2027-1-1 9:00')
  })

  it('finishes when the next occurrence is past untilAt', () => {
    const r = {
      ...base,
      kind: 'RECURRING' as const,
      rrule: 'FREQ=WEEKLY;BYHOUR=18;BYMINUTE=0',
      untilAt: at(2026, 11, 20, 0),
    }
    expect(advance(r, at(2026, 11, 16, 18)).status).toBe('DONE')
  })
})
