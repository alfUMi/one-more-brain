import { parseRrule, WEEKDAYS } from './recurrence'
import { toLocal } from './time'

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

export interface FormatterOptions {
  locale: string
  timeZone: string
  /** Looks up an i18n key (e.g. `reminder.today`) and fills `{placeholders}`. */
  t: (key: string, vars?: Record<string, string | number>) => string
}

/** Dates, reminders and recurrences in the user's language and time zone (web, extension, mobile). */
export function createFormatter({ locale, timeZone, t }: FormatterOptions) {
  function relative(iso: string, now = Date.now()): string {
    const seconds = (new Date(iso).getTime() - now) / 1000
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
    for (const [unit, size] of UNITS) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
    }
    return rtf.format(0, 'minute')
  }

  function time(date: Date): string {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date)
  }

  /** "Today, 18:00", "Tomorrow, 09:00", "Fri, 09:00", "20 Nov, 09:00". */
  function when(input: Date | string, now = new Date()): string {
    const date = new Date(input)
    const day = (d: Date) => {
      const l = toLocal(d, timeZone)
      return Date.UTC(l.year, l.month - 1, l.day) / 86_400_000
    }
    const diff = day(date) - day(now)
    const hm = time(date)
    if (diff === 0) return `${t('reminder.today')}, ${hm}`
    if (diff === 1) return `${t('reminder.tomorrowShort')}, ${hm}`
    if (diff === -1) return `${t('reminder.yesterday')}, ${hm}`
    const opts: Intl.DateTimeFormatOptions =
      diff > 1 && diff < 7
        ? { weekday: 'short' }
        : {
            day: 'numeric',
            month: 'short',
            ...(toLocal(date, timeZone).year !== toLocal(now, timeZone).year && {
              year: 'numeric',
            }),
          }
    return `${new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(date)}, ${hm}`
  }

  function weekdayName(index: number): string {
    // 2024-01-01 was a Monday.
    return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, 0, 1 + index)),
    )
  }

  function ordinal(n: number): string {
    if (locale !== 'en') return String(n)
    const rule = new Intl.PluralRules('en', { type: 'ordinal' }).select(n)
    return `${n}${{ one: 'st', two: 'nd', few: 'rd', other: 'th' }[rule as 'one'] ?? 'th'}`
  }

  /** "Every month on the 1st, 10:00", "Каждый пн, чт, 09:30". */
  function recurrence(rrule: string): string {
    const r = parseRrule(rrule)
    if (!r) return rrule
    const hm = `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`
    const n = r.interval
    let text: string
    switch (r.freq) {
      case 'DAILY':
        text = n > 1 ? t('reminder.every.days', { n }) : t('reminder.every.day')
        break
      case 'WEEKLY':
        if (n === 1 && r.byDay?.join() === 'MO,TU,WE,TH,FR') text = t('reminder.every.weekdays')
        else if (n === 1 && r.byDay?.length)
          text = t('reminder.every.weekOn', {
            days: r.byDay.map((d) => weekdayName(WEEKDAYS.indexOf(d))).join(', '),
          })
        else text = n > 1 ? t('reminder.every.weeks', { n }) : t('reminder.every.week')
        break
      case 'MONTHLY':
        if (n === 1 && r.byMonthDay)
          text = t('reminder.every.monthOn', { day: ordinal(r.byMonthDay) })
        else text = n > 1 ? t('reminder.every.months', { n }) : t('reminder.every.month')
        break
      case 'YEARLY':
        text = n > 1 ? t('reminder.every.years', { n }) : t('reminder.every.year')
        break
    }
    return `${text}, ${hm}`
  }

  function reminder(r: {
    kind: 'TIME' | 'RECURRING' | 'LOCATION'
    fireAt: Date | string | null
    rrule?: string | null
  }): string {
    if (r.kind === 'RECURRING' && r.rrule) return recurrence(r.rrule)
    return r.fireAt ? when(r.fireAt) : ''
  }

  return { relative, when, time, recurrence, reminder }
}

export type Formatter = ReturnType<typeof createFormatter>
