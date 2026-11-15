import { idSchema, updateReminderSchema, type ReminderDto } from '@omb/shared'

/** Moves, completes, cancels or accepts a reminder. */
export default defineEventHandler(async (event): Promise<ReminderDto> => {
  const userId = await requireUserId(event)
  const id = idSchema.parse(getRouterParam(event, 'id'))
  const input = await readValidatedBody(event, (body) => updateReminderSchema.parse(body))

  const reminder = await db.reminder.findFirst({ where: { id, userId, deletedAt: null } })
  if (!reminder) throw createError({ statusCode: 404, statusMessage: 'Reminder not found' })

  const updated = await db.reminder.update({
    where: { id },
    data: {
      ...(input.fireAt && { fireAt: input.fireAt, status: 'ACTIVE' }),
      ...(input.status && { status: input.status }),
      ...(input.accept && { isAiSuggested: false }),
      ...(input.status === 'CANCELLED' && { deletedAt: new Date() }),
    },
  })
  return toReminderDto(updated)
})
