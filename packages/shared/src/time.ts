/** Wall-clock date and time in some time zone. Month is 1-12. */
export interface LocalDateTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatters.set(timeZone, f)
  }
  return f
}

/** The wall-clock time of `date` in `timeZone`. */
export function toLocal(date: Date, timeZone: string): LocalDateTime & { second: number } {
  const parts: Record<string, number> = {}
  for (const p of formatter(timeZone).formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value)
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour! % 24,
    minute: parts.minute!,
    second: parts.second!,
  }
}

/** Offset of `timeZone` from UTC at `date`, in minutes (Berlin in winter = 60). */
export function offsetMinutes(date: Date, timeZone: string): number {
  const l = toLocal(date, timeZone)
  const asUtc = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, l.second)
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000)
}

/**
 * The instant at which the wall clock in `timeZone` shows `local`.
 * In a DST gap the time is moved forward; in an overlap the earlier instant wins.
 */
export function fromLocal(local: LocalDateTime, timeZone: string): Date {
  const guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
  const first = offsetMinutes(new Date(guess), timeZone)
  let t = guess - first * 60_000
  const second = offsetMinutes(new Date(t), timeZone)
  if (second !== first) {
    const alt = guess - second * 60_000
    // Prefer the candidate that maps back onto the requested wall clock (overlap), else the later one (gap).
    t = toLocal(new Date(alt), timeZone).hour === local.hour ? Math.min(t, alt) : Math.max(t, alt)
  }
  return new Date(t)
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}
