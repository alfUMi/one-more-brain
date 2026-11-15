import { fromLocal, toLocal } from './time'

/**
 * A small RFC 5545 RRULE subset, enough for what smart capture produces:
 * FREQ (DAILY | WEEKLY | MONTHLY | YEARLY), INTERVAL, BYDAY (weekly), BYMONTHDAY, BYHOUR, BYMINUTE.
 */
export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
export type Weekday = (typeof WEEKDAYS)[number]
export const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type Freq = (typeof FREQS)[number]

export interface Recurrence {
  freq: Freq
  interval: number
  byDay?: Weekday[]
  byMonthDay?: number
  hour: number
  minute: number
}

export function formatRrule(r: Recurrence): string {
  const parts = [`FREQ=${r.freq}`]
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`)
  if (r.byDay?.length) parts.push(`BYDAY=${r.byDay.join(',')}`)
  if (r.byMonthDay) parts.push(`BYMONTHDAY=${r.byMonthDay}`)
  parts.push(`BYHOUR=${r.hour}`, `BYMINUTE=${r.minute}`)
  return parts.join(';')
}

/** Parses an RRULE produced by formatRrule. Returns null for anything outside the subset. */
export function parseRrule(rrule: string): Recurrence | null {
  const fields = new Map<string, string>()
  for (const part of rrule.replace(/^RRULE:/, '').split(';')) {
    const [key, value] = part.split('=')
    if (key && value) fields.set(key.toUpperCase(), value.toUpperCase())
  }
  const freq = fields.get('FREQ') as Freq | undefined
  if (!freq || !FREQS.includes(freq)) return null
  const interval = Number(fields.get('INTERVAL') ?? 1)
  const hour = Number(fields.get('BYHOUR') ?? 9)
  const minute = Number(fields.get('BYMINUTE') ?? 0)
  const byDay = fields.get('BYDAY')?.split(',') as Weekday[] | undefined
  const byMonthDay = fields.has('BYMONTHDAY') ? Number(fields.get('BYMONTHDAY')) : undefined
  if (!Number.isInteger(interval) || interval < 1 || interval > 1000) return null
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null
  if (byDay && !byDay.every((d) => WEEKDAYS.includes(d))) return null
  if (byMonthDay !== undefined && !(byMonthDay >= 1 && byMonthDay <= 31)) return null
  return { freq, interval, byDay, byMonthDay, hour, minute }
}

const DAY_MS = 86_400_000

/** Days since epoch for a calendar date; time zone independent. */
function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}

function fromDayNumber(n: number): { year: number; month: number; day: number; weekday: Weekday } {
  const d = new Date(n * DAY_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: WEEKDAYS[(d.getUTCDay() + 6) % 7]!,
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * The first occurrence strictly after `after`, in `timeZone`.
 * `anchor` is a previous (or the first) occurrence; INTERVAL counts periods from it.
 */
export function nextOccurrence(
  rule: Recurrence | string,
  opts: { anchor: Date; after: Date; timeZone: string },
): Date | null {
  const r = typeof rule === 'string' ? parseRrule(rule) : rule
  if (!r) return null
  const a = toLocal(opts.anchor, opts.timeZone)
  const anchorDay = dayNumber(a.year, a.month, a.day)
  const anchorWeekday = fromDayNumber(anchorDay).weekday
  const anchorMonths = a.year * 12 + a.month - 1
  const days = r.byDay?.length ? r.byDay : [anchorWeekday]
  const monthDay = r.byMonthDay ?? a.day

  const s = toLocal(opts.after, opts.timeZone)
  const start = Math.max(dayNumber(s.year, s.month, s.day), anchorDay)
  // Mondays, so weekly intervals count calendar weeks.
  const anchorWeek = Math.floor((anchorDay + 3) / 7)

  for (let n = start; n < start + 366 * Math.min(r.interval, 10) + 400; n++) {
    const d = fromDayNumber(n)
    let match = false
    switch (r.freq) {
      case 'DAILY':
        match = (n - anchorDay) % r.interval === 0
        break
      case 'WEEKLY':
        match =
          days.includes(d.weekday) && (Math.floor((n + 3) / 7) - anchorWeek) % r.interval === 0
        break
      case 'MONTHLY':
        match =
          d.day === Math.min(monthDay, daysInMonth(d.year, d.month)) &&
          (d.year * 12 + d.month - 1 - anchorMonths) % r.interval === 0
        break
      case 'YEARLY':
        match =
          d.month === a.month &&
          d.day === Math.min(a.day, daysInMonth(d.year, d.month)) &&
          (d.year - a.year) % r.interval === 0
        break
    }
    if (!match) continue
    const at = fromLocal({ ...d, hour: r.hour, minute: r.minute }, opts.timeZone)
    if (at.getTime() > opts.after.getTime()) return at
  }
  return null
}
