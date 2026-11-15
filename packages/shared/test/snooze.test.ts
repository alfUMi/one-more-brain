import { describe, expect, it } from 'vitest'
import { snoozeUntil } from '../src/snooze'
import { toLocal } from '../src/time'

const tz = 'Europe/Berlin'
const local = (d: Date) => {
  const l = toLocal(d, tz)
  return `${l.month}-${l.day} ${l.hour}:${String(l.minute).padStart(2, '0')}`
}

describe('snoozeUntil', () => {
  const afternoon = new Date('2026-11-15T13:00:00Z') // 14:00 in Berlin
  const lateEvening = new Date('2026-11-15T21:30:00Z') // 22:30 in Berlin

  it('adds minutes and hours', () => {
    expect(snoozeUntil('10m', afternoon, tz).toISOString()).toBe('2026-11-15T13:10:00.000Z')
    expect(snoozeUntil('1h', afternoon, tz).toISOString()).toBe('2026-11-15T14:00:00.000Z')
  })

  it('tonight is 20:00 today, or tomorrow once the evening has started', () => {
    expect(local(snoozeUntil('tonight', afternoon, tz))).toBe('11-15 20:00')
    expect(local(snoozeUntil('tonight', lateEvening, tz))).toBe('11-16 20:00')
  })

  it('tomorrow is 09:00 the next local day, even just before midnight UTC', () => {
    expect(local(snoozeUntil('tomorrow', lateEvening, tz))).toBe('11-16 9:00')
    // 00:30 Berlin on the 16th is still the 15th in UTC.
    expect(local(snoozeUntil('tomorrow', new Date('2026-11-15T23:30:00Z'), tz))).toBe('11-17 9:00')
  })
})
