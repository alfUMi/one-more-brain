import type { NotifyReminderJob, PrismaClient } from '@omb/db'
import type { Job } from 'pg-boss'
import { log } from './log'

/**
 * Delivers a fired reminder. Channels (Web Push first) plug in here; until a user has one,
 * the reminder only shows up in the app.
 */
export function notifyReminder(db: PrismaClient) {
  return async (jobs: Job<NotifyReminderJob>[]) => {
    for (const job of jobs) {
      const reminder = await db.reminder.findUnique({
        where: { id: job.data.reminderId },
        select: { id: true, userId: true, deletedAt: true, status: true },
      })
      if (!reminder || reminder.deletedAt || reminder.status === 'CANCELLED') continue
      log.info('reminder fired', { reminderId: reminder.id, firedAt: job.data.firedAt })
    }
  }
}
