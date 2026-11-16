import {
  AI_JOB_OPTIONS,
  fromPrisma,
  getBoss,
  QUEUES,
  type AiEnrichJob,
  type NotifyDigestJob,
  type Prisma,
} from '@omb/db'
import type { PgBoss } from 'pg-boss'

let started: Promise<PgBoss> | undefined

/** Send-only pg-boss: the worker owns its schema, cron and maintenance. */
function queue(): Promise<PgBoss> {
  started ??= (async () => {
    const boss = getBoss({ sendOnly: true })
    boss.on('error', (error) => console.error('[queue]', error))
    await boss.start()
    await boss.createQueue(QUEUES.aiEnrich)
    await boss.createQueue(QUEUES.notifyDigest)
    return boss
  })().catch((error: unknown) => {
    started = undefined // try again on the next call
    throw error
  })
  return started
}

/** Queues AI enrichment inside the caller's transaction, so an item never exists without its job. */
export async function enqueueEnrich(tx: Prisma.TransactionClient, itemId: string) {
  const boss = await queue()
  const job: AiEnrichJob = { itemId }
  await boss.send(QUEUES.aiEnrich, job, { ...AI_JOB_OPTIONS, db: fromPrisma(tx) })
}

/** Sends the user's digest right away, even when there is nothing due (Settings › Send a test). */
export async function enqueueTestDigest(userId: string) {
  const boss = await queue()
  const job: NotifyDigestJob = { userId, since: new Date().toISOString(), test: true }
  await boss.send(QUEUES.notifyDigest, job, { retryLimit: 2, retryDelay: 10 })
}
