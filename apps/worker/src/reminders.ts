import { fromPrisma, QUEUES, type NotifyReminderJob, type PrismaClient } from '@omb/db'
import { nextOccurrence } from '@omb/shared'
import type { PgBoss } from 'pg-boss'

export interface DueReminder {
  id: string
  kind: 'TIME' | 'RECURRING' | 'LOCATION'
  fireAt: Date
  rrule: string | null
  timezone: string
  untilAt: Date | null
}

export interface Advanced {
  status: 'ACTIVE' | 'FIRED' | 'DONE'
  fireAt: Date
}

/**
 * What a reminder becomes after it fires at `now`. One-off reminders are FIRED. Recurring ones move to
 * their next occurrence after `now`, so occurrences missed during downtime fire once, not one by one.
 */
export function advance(r: DueReminder, now: Date): Advanced {
  if (r.kind !== 'RECURRING' || !r.rrule) return { status: 'FIRED', fireAt: r.fireAt }
  const after = now > r.fireAt ? now : r.fireAt
  const next = nextOccurrence(r.rrule, { anchor: r.fireAt, after, timeZone: r.timezone })
  if (!next || (r.untilAt && next > r.untilAt)) return { status: 'DONE', fireAt: r.fireAt }
  return { status: 'ACTIVE', fireAt: next }
}

/**
 * Fires every due reminder: enqueues its delivery and advances it, in one transaction, so a reminder
 * is never marked fired without its job. SKIP LOCKED lets several workers scan safely.
 */
export async function scanReminders(db: PrismaClient, boss: PgBoss, now = new Date()) {
  return db.$transaction(async (tx) => {
    const due = await tx.$queryRaw<DueReminder[]>`
      SELECT id, kind::text AS kind, "fireAt", rrule, timezone, "untilAt"
      FROM "Reminder"
      WHERE status = 'ACTIVE' AND "isAiSuggested" = false AND "deletedAt" IS NULL
        -- Prisma stores DateTime as UTC without a zone; compare in UTC whatever the session TimeZone is.
        AND "fireAt" IS NOT NULL AND "fireAt" <= (${now}::timestamptz AT TIME ZONE 'UTC')
      ORDER BY "fireAt"
      LIMIT 200
      FOR UPDATE SKIP LOCKED`

    for (const r of due) {
      const job: NotifyReminderJob = { reminderId: r.id, firedAt: r.fireAt.toISOString() }
      await boss.send(QUEUES.notifyReminder, job, {
        db: fromPrisma(tx),
        retryLimit: 5,
        retryDelay: 30,
        retryBackoff: true,
      })
      const next = advance(r, now)
      await tx.reminder.update({
        where: { id: r.id },
        data: { status: next.status, fireAt: next.fireAt, lastFiredAt: now },
      })
    }
    return due.length
  })
}
