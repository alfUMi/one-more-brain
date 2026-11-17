import type { PrismaClient } from '@omb/db'
import { fromLocal, nextOccurrence, toLocal, type AppSchedule } from '@omb/shared'
import { messages } from '@omb/shared/i18n'
import { composeDigest, loadDigest, notificationTitle } from './digest'

/** How far ahead the phone schedules, and how many (iOS keeps at most 64 pending notifications). */
export const SCHEDULE_DAYS = 7
export const SCHEDULE_MAX = 50

export interface SchedulableReminder {
  kind: 'TIME' | 'RECURRING' | 'LOCATION'
  fireAt: Date | null
  rrule: string | null
  timezone: string
  untilAt: Date | null
}

/** Every time a reminder fires in (from, to], recurring ones expanded, at most `max`. */
export function occurrences(r: SchedulableReminder, from: Date, to: Date, max: number): Date[] {
  if (!r.fireAt || r.kind === 'LOCATION') return []
  const out: Date[] = []
  let at: Date | null = r.fireAt
  if (r.kind === 'RECURRING' && r.rrule && at <= from) {
    at = nextOccurrence(r.rrule, { anchor: r.fireAt, after: from, timeZone: r.timezone })
  }
  while (at && at <= to && out.length < max) {
    if (r.untilAt && at > r.untilAt) break
    if (at > from) out.push(at)
    if (r.kind !== 'RECURRING' || !r.rrule) break
    at = nextOccurrence(r.rrule, { anchor: r.fireAt, after: at, timeZone: r.timezone })
  }
  return out
}

/** The next time the digest goes out after `now`: today at digestTime, or tomorrow. */
export function nextDigestAt(now: Date, user: { timezone: string; digestTime: string }): Date {
  let tz = user.timezone
  let l
  try {
    l = toLocal(now, tz)
  } catch {
    tz = 'UTC'
    l = toLocal(now, tz)
  }
  const [hour = 8, minute = 0] = user.digestTime.split(':').map(Number)
  const today = fromLocal({ year: l.year, month: l.month, day: l.day, hour, minute }, tz)
  if (today > now) return today
  const next = new Date(Date.UTC(l.year, l.month - 1, l.day + 1))
  return fromLocal(
    {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
      hour,
      minute,
    },
    tz,
  )
}

/**
 * The phone's notification schedule: the next week of reminders and the next digest, written as
 * the server would send them. `test` puts a digest due right now, even when there is little to say.
 */
export async function loadSchedule(
  db: PrismaClient,
  userId: string,
  now = new Date(),
  { test = false } = {},
): Promise<AppSchedule> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, locale: true, timezone: true, digestTime: true, digestEnabled: true },
  })
  const strings = messages[user.locale === 'ru' ? 'ru' : 'en']
  const until = new Date(now.getTime() + SCHEDULE_DAYS * 86_400_000)

  const rows = await db.reminder.findMany({
    where: {
      userId,
      deletedAt: null,
      isAiSuggested: false,
      status: 'ACTIVE',
      kind: { in: ['TIME', 'RECURRING'] },
      fireAt: { not: null },
      item: { deletedAt: null },
      // Recurring reminders fire again later; one-off ones only matter inside the window.
      OR: [{ kind: 'RECURRING' }, { fireAt: { gt: now, lte: until } }],
    },
    select: {
      id: true,
      kind: true,
      fireAt: true,
      rrule: true,
      timezone: true,
      untilAt: true,
      item: {
        select: { id: true, title: true, body: true, quote: true, pageTitle: true, url: true },
      },
    },
  })
  const reminders = rows
    .flatMap((r) =>
      occurrences(r, now, until, SCHEDULE_MAX).map((at) => ({
        key: `r:${r.id}:${at.toISOString()}`,
        reminderId: r.id,
        itemId: r.item.id,
        at: at.toISOString(),
        title: notificationTitle(r.item) ?? strings.notify.untitled,
      })),
    )
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, SCHEDULE_MAX)

  let digest: AppSchedule['digest'] = null
  if (user.digestEnabled || test) {
    const at = test ? now : nextDigestAt(now, user)
    const content = await loadDigest(db, user, at)
    const text = composeDigest(content, strings.digest, at, test)
    if (text) {
      digest = {
        key: `d:${at.toISOString()}`,
        at: at.toISOString(),
        ...text,
        reviewItemId: content.review?.itemId ?? null,
      }
    }
  }
  return {
    generatedAt: now.toISOString(),
    reminders,
    digest,
    reminderBody: strings.notify.reminder,
  }
}
