import { PUSH_CHANNEL_KINDS } from '@omb/shared'
import { z } from 'zod'

/** Stops reminders to one browser (Settings › Devices). */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = z.uuid().parse(getRouterParam(event, 'id'))
  await db.channel.deleteMany({ where: { id, userId, kind: { in: [...PUSH_CHANNEL_KINDS] } } })
  setResponseStatus(event, 204)
  return null
})
