import { idSchema, startReview, type ItemDto } from '@omb/shared'

/** "Remember": adds the item to spaced repetition. Doing it again restarts the schedule. */
export default defineEventHandler(async (event): Promise<ItemDto> => {
  const userId = await requireUserId(event)
  const itemId = idSchema.parse(getRouterParam(event, 'id'))
  await findItemOr404(userId, itemId)

  const r = startReview(new Date())
  await db.review.upsert({
    where: { itemId },
    create: { itemId, userId, step: r.step, nextAt: r.nextAt },
    update: { step: r.step, nextAt: r.nextAt, graduatedAt: null },
  })
  return toItemDto(await findItemOr404(userId, itemId))
})
