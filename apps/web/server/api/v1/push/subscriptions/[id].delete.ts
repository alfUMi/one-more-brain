import { z } from 'zod'

/** Stops reminders to one browser (Settings › Devices). */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = z.uuid().parse(getRouterParam(event, 'id'))
  await db.channel.deleteMany({ where: { id, userId, kind: 'WEB_PUSH' } })
  setResponseStatus(event, 204)
  return null
})
