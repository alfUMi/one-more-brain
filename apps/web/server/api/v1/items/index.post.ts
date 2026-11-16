import { createItemSchema, MAX_UPLOAD_BYTES, startReview, type ItemDto } from '@omb/shared'

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

  // Every listed attachment must already be uploaded, at the key we derive for it.
  const attachments = await Promise.all(
    input.attachments.map(async (a) => {
      const key = storageKey(userId, input.id, a.id, a.mime)
      const head = await headObject(key)
      if (!head || head.sizeBytes > MAX_UPLOAD_BYTES) {
        throw createError({ statusCode: 400, statusMessage: `Attachment ${a.id} is not uploaded` })
      }
      return { ...a, storageKey: key, sizeBytes: head.sizeBytes }
    }),
  )

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
          favicon: input.favicon || null,
          capturedAt: input.capturedAt,
        },
      })
      await setItemTags(tx, userId, input.id, input.tags)
      if (attachments.length) {
        await tx.attachment.createMany({
          data: attachments.map((a) => ({
            id: a.id,
            userId,
            itemId: input.id,
            kind: a.kind,
            storageKey: a.storageKey,
            mime: a.mime,
            sizeBytes: a.sizeBytes,
            width: a.width ?? null,
            height: a.height ?? null,
          })),
        })
      }
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
      await enqueueEnrich(tx, input.id)
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
