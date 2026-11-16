import { modalController } from '@ionic/vue'
import { fromLocal, toLocal } from '@omb/shared'
import type { RemindChoice } from './actions'
import RemindSheet from '../components/RemindSheet.vue'

/** A wall-clock time `days` from today in the zone. */
export function at(timeZone: string, days: number, hour: number, minute = 0): Date {
  const l = toLocal(new Date(), timeZone)
  const d = new Date(Date.UTC(l.year, l.month - 1, l.day + days))
  return fromLocal(
    { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour, minute },
    timeZone,
  )
}

/** The Remind sheet's presets: later today, tonight, tomorrow morning, next week (Monday). */
export function remindPresets(timeZone: string, now = new Date()) {
  const local = toLocal(now, timeZone)
  const later = new Date(Math.ceil((now.getTime() + 3 * 3_600_000) / 900_000) * 900_000)
  const sameDay = toLocal(later, timeZone).day === local.day && toLocal(later, timeZone).hour < 22
  const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay()
  const toMonday = (8 - weekday) % 7 || 7
  const options = [
    ...(sameDay ? [{ key: 'laterToday', at: later }] : []),
    ...(local.hour < 19 ? [{ key: 'tonight', at: at(timeZone, 0, 20) }] : []),
    { key: 'tomorrow', at: at(timeZone, 1, 9) },
    { key: 'nextWeek', at: at(timeZone, toMonday, 9) },
  ]
  // Drop options within an hour of an earlier one ("next week" on a Sunday is tomorrow).
  return options.filter(
    (o, i) =>
      !options.slice(0, i).some((p) => Math.abs(p.at.getTime() - o.at.getTime()) < 3_600_000),
  )
}

/** Opens the Remind sheet; resolves with the pick, or null when dismissed. */
export async function pickReminder(): Promise<RemindChoice | null> {
  const modal = await modalController.create({
    component: RemindSheet,
    cssClass: 'omb-sheet omb-auto-sheet',
    breakpoints: [0, 1],
    initialBreakpoint: 1,
    handle: true,
  })
  await modal.present()
  const { data, role } = await modal.onWillDismiss<RemindChoice>()
  return role === 'pick' && data ? data : null
}
