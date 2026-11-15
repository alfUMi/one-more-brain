import type { SnoozePreset } from './schemas'
import { fromLocal, toLocal } from './time'

/** Wall-clock `hour`:00, `days` after today in `timeZone`. */
function localAt(now: Date, timeZone: string, days: number, hour: number): Date {
  const l = toLocal(now, timeZone)
  const d = new Date(Date.UTC(l.year, l.month - 1, l.day + days))
  return fromLocal(
    { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour, minute: 0 },
    timeZone,
  )
}

/** When a snoozed reminder comes back. "tonight" is 20:00 (tomorrow's once it is past 19:00). */
export function snoozeUntil(preset: SnoozePreset, now: Date, timeZone: string): Date {
  switch (preset) {
    case '10m':
      return new Date(now.getTime() + 10 * 60_000)
    case '1h':
      return new Date(now.getTime() + 60 * 60_000)
    case 'tonight':
      return localAt(now, timeZone, toLocal(now, timeZone).hour < 19 ? 0 : 1, 20)
    case 'tomorrow':
      return localAt(now, timeZone, 1, 9)
  }
}
