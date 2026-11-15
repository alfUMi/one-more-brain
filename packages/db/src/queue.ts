import { PgBoss } from 'pg-boss'

/** Background job queues (pg-boss, stored in the same Postgres under the `pgboss` schema). */
export const QUEUES = {
  /** Cron, every minute: find due reminders and enqueue their deliveries. */
  scanReminders: 'reminders.scan',
  /** Deliver one fired reminder to the user's channels. */
  notifyReminder: 'notify.reminder',
  /** Title, tags, reminder suggestion and image text for a new or edited item. */
  aiEnrich: 'ai.enrich',
} as const

export interface AiEnrichJob {
  itemId: string
}

/** Retry policy for AI jobs: a few attempts with backoff (rate limits, transient 5xx). */
export const AI_JOB_OPTIONS = { retryLimit: 3, retryDelay: 20, retryBackoff: true } as const

export interface NotifyReminderJob {
  reminderId: string
  /** The occurrence that fired (the reminder's fireAt before it advanced). */
  firedAt: string
}

let boss: PgBoss | undefined

/**
 * Shared pg-boss instance. Call start() once per process before sending or working.
 * `sendOnly` is for the web app: it enqueues jobs but leaves maintenance, cron and schema
 * migrations to the worker.
 */
export function getBoss(opts: { sendOnly?: boolean } = {}): PgBoss {
  if (!boss) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL is not set')
    boss = new PgBoss({
      connectionString,
      application_name: opts.sendOnly ? 'omb-web' : 'omb-worker',
      ...(opts.sendOnly && { supervise: false, schedule: false, migrate: false, max: 2 }),
    })
  }
  return boss
}

export { fromPrisma } from 'pg-boss'
