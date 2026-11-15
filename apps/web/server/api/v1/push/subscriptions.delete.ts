import { z } from 'zod'

const bodySchema = z.object({ endpoint: z.url().max(2_000) })

/** Forgets this browser's subscription (the user turned notifications off). */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { endpoint } = await readValidatedBody(event, (body) => bodySchema.parse(body))
  await db.channel.deleteMany({ where: { userId, kind: 'WEB_PUSH', address: endpoint } })
  setResponseStatus(event, 204)
  return null
})
