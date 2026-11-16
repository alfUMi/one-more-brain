import { z } from 'zod'

const bodySchema = z.object({ token: z.string().min(20).max(4_096) })

/** The app turned notifications off on this device (or signed out). */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { token } = await readValidatedBody(event, (body) => bodySchema.parse(body))
  await db.channel.deleteMany({ where: { userId, kind: 'FCM', address: token } })
  setResponseStatus(event, 204)
  return null
})
