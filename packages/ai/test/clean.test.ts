import { toLocal } from '@omb/shared'
import { describe, expect, it } from 'vitest'
import { clean } from '../src/enrich'

const tz = 'Europe/Berlin'
const now = new Date('2026-11-15T10:00:00Z') // Sunday 11:00 in Berlin
const ctx = { now, timeZone: tz, hasReminder: false }
const base = { title: '', tags: [], language: 'en' as const, imageText: '', reminder: null }
const local = (d: Date) => {
  const l = toLocal(d, tz)
  return `${l.year}-${l.month}-${l.day} ${l.hour}:${String(l.minute).padStart(2, '0')}`
}

describe('clean', () => {
  it('normalizes tags and drops invalid ones', () => {
    const r = clean({ ...base, tags: ['#Books', 'read later', 'books', 'a b!c', 'x', 'y'] }, ctx)
    expect(r.tags).toEqual(['books', 'read-later', 'x'])
  })

  it('trims titles and turns empty strings into null', () => {
    expect(clean({ ...base, title: '  Parking spot. ' }, ctx).title).toBe('Parking spot')
    expect(clean(base, ctx).title).toBeNull()
    expect(clean(base, ctx).imageText).toBeNull()
  })

  it('converts a local reminder time in the user zone', () => {
    const r = clean({ ...base, reminder: { when: '2026-11-21T10:00', repeat: 'none' } }, ctx)
    expect(local(r.reminder!.fireAt)).toBe('2026-11-21 10:00')
    expect(r.reminder!.rrule).toBeNull()
  })

  it('builds rrules from the repeat word', () => {
    const weekly = clean({ ...base, reminder: { when: '2026-11-18T19:30', repeat: 'weekly' } }, ctx)
    expect(weekly.reminder!.rrule).toBe('FREQ=WEEKLY;BYDAY=WE;BYHOUR=19;BYMINUTE=30')
    const monthly = clean(
      { ...base, reminder: { when: '2026-11-30T09:00', repeat: 'monthly' } },
      ctx,
    )
    expect(monthly.reminder!.rrule).toBe('FREQ=MONTHLY;BYMONTHDAY=30;BYHOUR=9;BYMINUTE=0')
  })

  it('drops past, malformed and duplicate reminders', () => {
    expect(
      clean({ ...base, reminder: { when: '2026-11-15T09:00', repeat: 'none' } }, ctx).reminder,
    ).toBeNull()
    expect(
      clean({ ...base, reminder: { when: 'next week', repeat: 'none' } }, ctx).reminder,
    ).toBeNull()
    expect(
      clean(
        { ...base, reminder: { when: '2026-11-21T10:00', repeat: 'none' } },
        { ...ctx, hasReminder: true },
      ).reminder,
    ).toBeNull()
  })
})
