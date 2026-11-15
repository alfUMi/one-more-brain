import { describe, expect, it } from 'vitest'
import { parseCapture } from '../src/capture'
import { nextOccurrence, parseRrule } from '../src/recurrence'
import { fromLocal, toLocal } from '../src/time'

// Sunday 15 Nov 2026, 11:00 in Berlin (UTC+1).
const now = new Date('2026-11-15T10:00:00Z')
const tz = 'Europe/Berlin'
const opts = { now, timeZone: tz }

function local(d: Date | undefined) {
  if (!d) return null
  const l = toLocal(d, tz)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${l.year}-${p(l.month)}-${p(l.day)} ${p(l.hour)}:${p(l.minute)}`
}

describe('parseCapture: tags and tokens', () => {
  it('extracts tags and strips them from the body', () => {
    const r = parseCapture('#book Thinking Fast and Slow #Psychology #book', opts)
    expect(r.tags).toEqual(['book', 'psychology'])
    expect(r.body).toBe('Thinking Fast and Slow')
    expect(r.reminder).toBeNull()
  })

  it('handles Cyrillic tags and !remember', () => {
    const r = parseCapture('идея для статьи #идеи !запомнить', opts)
    expect(r.tags).toEqual(['идеи'])
    expect(r.remember).toBe(true)
    expect(r.body).toBe('идея для статьи')
  })

  it('ignores # inside words and URLs', () => {
    const r = parseCapture('see https://example.com/page#section and C#', opts)
    expect(r.tags).toEqual([])
    expect(r.urls).toEqual(['https://example.com/page#section'])
  })
})

describe('parseCapture: one-off reminders', () => {
  it('parses an English date and time', () => {
    const r = parseCapture('call mom tomorrow 18:00', opts)
    expect(r.reminder?.kind).toBe('TIME')
    expect(local(r.reminder?.fireAt)).toBe('2026-11-16 18:00')
    expect(r.reminder?.text).toBe('tomorrow 18:00')
    expect(r.body).toBe('call mom tomorrow 18:00')
  })

  it('reads a bare small hour as evening, in Russian too', () => {
    const r = parseCapture('позвонить маме завтра в 6', opts)
    expect(local(r.reminder?.fireAt)).toBe('2026-11-16 18:00')
    expect(r.reminder?.text).toBe('завтра в 6')
  })

  it('keeps explicit morning times', () => {
    expect(local(parseCapture('gym tomorrow at 6am', opts).reminder?.fireAt)).toBe(
      '2026-11-16 06:00',
    )
    expect(local(parseCapture('run tomorrow 06:30', opts).reminder?.fireAt)).toBe(
      '2026-11-16 06:30',
    )
  })

  it('defaults a date without time to 09:00', () => {
    expect(local(parseCapture('buy milk friday', opts).reminder?.fireAt)).toBe('2026-11-20 09:00')
    expect(local(parseCapture('встреча в пятницу', opts).reminder?.fireAt)).toBe('2026-11-20 09:00')
  })

  it('ignores past times and plain text', () => {
    expect(parseCapture('I have 2 cats', opts).reminder).toBeNull()
    expect(parseCapture('meeting today at 8am', opts).reminder).toBeNull()
  })

  it('ignores dates inside URLs', () => {
    expect(parseCapture('https://blog.example.com/2027/05/12/post', opts).reminder).toBeNull()
  })
})

describe('parseCapture: recurring reminders', () => {
  it('monthly on a day', () => {
    const r = parseCapture('pay rent every month on the 1st', opts)
    expect(r.reminder?.kind).toBe('RECURRING')
    expect(r.reminder?.rrule).toBe('FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0')
    expect(local(r.reminder?.fireAt)).toBe('2026-12-01 09:00')
    expect(r.reminder?.text).toBe('every month on the 1st')
  })

  it('weekly on named days with a time', () => {
    const r = parseCapture('standup every mon and thu at 9:30', opts)
    expect(r.reminder?.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,TH;BYHOUR=9;BYMINUTE=30')
    expect(local(r.reminder?.fireAt)).toBe('2026-11-16 09:30')
  })

  it('daily in Russian', () => {
    const r = parseCapture('пить воду каждый день в 10 утра', opts)
    expect(r.reminder?.rrule).toBe('FREQ=DAILY;BYHOUR=10;BYMINUTE=0')
    expect(local(r.reminder?.fireAt)).toBe('2026-11-16 10:00')
  })

  it('weekly on a Russian weekday', () => {
    const r = parseCapture('выносить мусор каждую среду в 8 вечера', opts)
    expect(r.reminder?.rrule).toBe('FREQ=WEEKLY;BYDAY=WE;BYHOUR=20;BYMINUTE=0')
    expect(local(r.reminder?.fireAt)).toBe('2026-11-18 20:00')
  })

  it('monthly day in Russian', () => {
    const r = parseCapture('платить за квартиру каждое 1 число', opts)
    expect(r.reminder?.rrule).toBe('FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0')
  })

  it('every other week', () => {
    const r = parseCapture('water plants every other week', opts)
    expect(r.reminder?.rrule).toBe('FREQ=WEEKLY;INTERVAL=2;BYHOUR=9;BYMINUTE=0')
    // Today is Sunday and 09:00 has passed, so the next one is two weeks out.
    expect(local(r.reminder?.fireAt)).toBe('2026-11-29 09:00')
  })
})

describe('nextOccurrence', () => {
  it('keeps the wall-clock time across DST', () => {
    const anchor = fromLocal({ year: 2027, month: 3, day: 27, hour: 9, minute: 0 }, tz)
    const next = nextOccurrence('FREQ=DAILY;BYHOUR=9;BYMINUTE=0', {
      anchor,
      after: anchor,
      timeZone: tz,
    })
    expect(local(next!)).toBe('2027-03-28 09:00')
    expect(next!.toISOString()).toBe('2027-03-28T07:00:00.000Z')
  })

  it('clamps a month day to short months', () => {
    const anchor = fromLocal({ year: 2027, month: 1, day: 31, hour: 9, minute: 0 }, tz)
    const next = nextOccurrence('FREQ=MONTHLY;BYMONTHDAY=31;BYHOUR=9;BYMINUTE=0', {
      anchor,
      after: anchor,
      timeZone: tz,
    })
    expect(local(next!)).toBe('2027-02-28 09:00')
  })

  it('rejects rules outside the subset', () => {
    expect(parseRrule('FREQ=HOURLY')).toBeNull()
    expect(parseRrule('FREQ=WEEKLY;BYDAY=XX')).toBeNull()
  })
})
