import { createItemSchema, startReview, type ItemDto } from '@omb/shared'

/**
 * Creates an item. The id comes from the client, so retries (offline outbox) are safe:
 * posting the same id again returns the existing item.
 */
export default defineEventHandler(async (event): Promise<ItemDto> => {
  const userId = await requireUserId(event)
  const input = await readValidatedBody(event, (body) => createItemSchema.parse(body))

  const existing = await db.item.findUnique({ where: { id: input.id }, include: itemInclude })
  if (existing) {
    if (existing.userId !== userId)
      throw createError({ statusCode: 409, statusMessage: 'Id taken' })
    return toItemDto(existing)
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.item.create({
        data: {
          id: input.id,
          userId,
          kind: input.kind,
          source: input.source,
          title: input.title || null,
          body: input.body || null,
          quote: input.quote || null,
          url: input.url || null,
          pageTitle: input.pageTitle || null,
          capturedAt: input.capturedAt,
        },
      })
      await setItemTags(tx, userId, input.id, input.tags)
      if (input.reminder) {
        await tx.reminder.create({
          data: {
            id: input.reminder.id,
            userId,
            itemId: input.id,
            kind: input.reminder.kind,
            fireAt: input.reminder.fireAt,
            rrule: input.reminder.rrule ?? null,
            timezone: input.reminder.timezone,
          },
        })
      }
      if (input.remember) {
        const review = startReview(new Date())
        await tx.review.create({
          data: { itemId: input.id, userId, step: review.step, nextAt: review.nextAt },
        })
      }
    })
  } catch (error) {
    // Two retries raced; the other one won and the item exists now.
    if (!isUniqueViolation(error)) throw error
  }

  setResponseStatus(event, 201)
  return toItemDto(await findItemOr404(userId, input.id))
})
