import { updateMeSchema } from '@omb/shared'
import type { Me } from '~~/server/utils/me'

export default defineEventHandler(async (event): Promise<Me> => {
  const userId = await requireUserId(event)
  const data = await readValidatedBody(event, (body) => updateMeSchema.parse(body))
  return db.user.update({ where: { id: userId }, data, select: meSelect })
})
