import { idSchema, reminderInputSchema, type ReminderDto } from '@omb/shared'

/** Adds a reminder to an item. The id comes from the client, so a retry returns the same reminder. */
export default defineEventHandler(async (event): Promise<ReminderDto> => {
  const userId = await requireUserId(event)
  const itemId = idSchema.parse(getRouterParam(event, 'id'))
  const input = await readValidatedBody(event, (body) => reminderInputSchema.parse(body))
  await findItemOr404(userId, itemId)

  const existing = await db.reminder.findUnique({ where: { id: input.id } })
  if (existing) {
    if (existing.userId !== userId || existing.itemId !== itemId) {
      throw createError({ statusCode: 409, statusMessage: 'Id taken' })
    }
    return toReminderDto(existing)
  }

  const reminder = await db.reminder.create({
    data: {
      id: input.id,
      userId,
      itemId,
      kind: input.kind,
      fireAt: input.fireAt,
      rrule: input.rrule ?? null,
      timezone: input.timezone,
    },
  })
  setResponseStatus(event, 201)
  return toReminderDto(reminder)
})
