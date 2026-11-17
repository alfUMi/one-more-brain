import { PUSH_CHANNEL_KINDS } from '@omb/shared'
import { enqueueTestDigest } from '../../../utils/queue'

/** Queues a test digest for the browsers. `channels` = how many will get it (the app shows its own). */
export default defineEventHandler(async (event): Promise<{ channels: number }> => {
  const userId = await requireUserId(event)
  const channels = await db.channel.count({
    where: { userId, kind: { in: [...PUSH_CHANNEL_KINDS] }, enabled: true },
  })
  if (channels) await enqueueTestDigest(userId)
  return { channels }
})
