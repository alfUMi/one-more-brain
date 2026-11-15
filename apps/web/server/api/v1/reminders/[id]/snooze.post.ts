import { idSchema, newId, snoozeSchema, snoozeUntil, type ReminderDto } from '@omb/shared'

/**
 * Brings a reminder back later. A one-off reminder simply moves. A recurring one keeps its schedule
 * and gets a one-off follow-up for this occurrence.
 */
export default defineEventHandler(async (event): Promise<ReminderDto> => {
  const userId = await requireUserId(event)
  const id = idSchema.parse(getRouterParam(event, 'id'))
  const input = await readValidatedBody(event, (body) => snoozeSchema.parse(body))

  const reminder = await db.reminder.findFirst({ where: { id, userId, deletedAt: null } })
  if (!reminder) throw createError({ statusCode: 404, statusMessage: 'Reminder not found' })

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true },
  })
  const until =
    'until' in input ? input.until : snoozeUntil(input.preset, new Date(), user.timezone)
  if (until.getTime() <= Date.now()) {
    throw createError({ statusCode: 400, statusMessage: 'Snooze time is in the past' })
  }

  const updated =
    reminder.kind === 'RECURRING'
      ? await db.reminder.create({
          data: {
            id: newId(),
            userId,
            itemId: reminder.itemId,
            kind: 'TIME',
            fireAt: until,
            timezone: user.timezone,
          },
        })
      : await db.reminder.update({
          where: { id },
          data: { fireAt: until, status: 'ACTIVE', isAiSuggested: false },
        })
  return toReminderDto(updated)
})
