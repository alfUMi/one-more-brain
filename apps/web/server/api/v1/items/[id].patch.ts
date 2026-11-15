import { idSchema, updateItemSchema, type ItemDto } from '@omb/shared'

export default defineEventHandler(async (event): Promise<ItemDto> => {
  const userId = await requireUserId(event)
  const id = idSchema.parse(getRouterParam(event, 'id'))
  const input = await readValidatedBody(event, (body) => updateItemSchema.parse(body))
  const item = await findItemOr404(userId, id)

  await db.$transaction(async (tx) => {
    await tx.item.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title || null, titleIsAi: false }),
        ...(input.body !== undefined && { body: input.body || null }),
        ...(input.status && {
          status: input.status,
          triagedAt: input.status === 'INBOX' ? null : (item.triagedAt ?? new Date()),
        }),
      },
    })
    if (input.tags) await setItemTags(tx, userId, id, input.tags)
    // Keeping an item confirms the tags the AI suggested for it.
    if (input.status === 'KEPT') {
      await tx.itemTag.updateMany({
        where: { itemId: id, suggested: true },
        data: { suggested: false },
      })
    }
  })

  return toItemDto(await findItemOr404(userId, id))
})
