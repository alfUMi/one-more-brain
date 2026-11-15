import { getBoss, getDb, QUEUES } from '@omb/db'
import { aiEnrich } from './enrich'
import { log } from './log'
import { notifyReminder } from './notify'
import { scanReminders } from './reminders'

const db = getDb()
const boss = getBoss()
boss.on('error', (error) => log.error('pg-boss', { error: String(error) }))

await boss.start()
for (const name of Object.values(QUEUES)) await boss.createQueue(name)

await boss.work(QUEUES.scanReminders, async () => {
  const fired = await scanReminders(db, boss)
  if (fired) log.info('reminders scanned', { fired })
})
await boss.work(QUEUES.notifyReminder, notifyReminder(db))
await boss.work(QUEUES.aiEnrich, { batchSize: 1 }, aiEnrich(db))
// Every minute; pg-boss makes sure only one worker runs each tick.
await boss.schedule(QUEUES.scanReminders, '* * * * *')

log.info('worker started')

async function shutdown(signal: string) {
  log.info('worker stopping', { signal })
  await boss.stop({ graceful: true, timeout: 20_000 })
  await db.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
