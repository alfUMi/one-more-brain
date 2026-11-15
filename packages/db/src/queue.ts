import { PgBoss } from 'pg-boss'

/** Background job queues (pg-boss, stored in the same Postgres under the `pgboss` schema). */
export const QUEUES = {
  /** Cron, every minute: find due reminders and enqueue their deliveries. */
  scanReminders: 'reminders.scan',
  /** Deliver one fired reminder to the user's channels. */
  notifyReminder: 'notify.reminder',
} as const

export interface NotifyReminderJob {
  reminderId: string
  /** The occurrence that fired (the reminder's fireAt before it advanced). */
  firedAt: string
}

let boss: PgBoss | undefined

/** Shared pg-boss instance. Call start() once per process before sending or working. */
export function getBoss(): PgBoss {
  if (!boss) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL is not set')
    boss = new PgBoss({ connectionString, application_name: 'omb' })
  }
  return boss
}

export { fromPrisma } from 'pg-boss'
