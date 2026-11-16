import { NOTIFY_CHANNEL_KINDS } from '@omb/shared'
import { enqueueTestDigest } from '../../../utils/queue'

/** Queues a test digest. `channels` = how many devices will get it (0: nothing to send to). */
export default defineEventHandler(async (event): Promise<{ channels: number }> => {
  const userId = await requireUserId(event)
  const channels = await db.channel.count({
    where: { userId, kind: { in: [...NOTIFY_CHANNEL_KINDS] }, enabled: true },
  })
  if (channels) await enqueueTestDigest(userId)
  return { channels }
})
