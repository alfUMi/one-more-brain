import { idSchema } from '@omb/shared'

/** Soft delete, so the deletion reaches other devices through /sync. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = idSchema.parse(getRouterParam(event, 'id'))
  await findItemOr404(userId, id)
  const now = new Date()
  await db.$transaction([
    db.item.update({ where: { id }, data: { deletedAt: now } }),
    db.reminder.updateMany({
      where: { itemId: id, deletedAt: null },
      data: { deletedAt: now, status: 'CANCELLED' },
    }),
  ])
  setResponseStatus(event, 204)
  return null
})
