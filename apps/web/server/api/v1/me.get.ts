import type { Me } from '~~/server/utils/me'

export default defineEventHandler(async (event): Promise<Me> => {
  const userId = await requireUserId(event)
  return db.user.findUniqueOrThrow({ where: { id: userId }, select: meSelect })
})
