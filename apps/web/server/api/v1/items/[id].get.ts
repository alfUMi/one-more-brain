import { idSchema, type ItemDto } from '@omb/shared'

export default defineEventHandler(async (event): Promise<ItemDto> => {
  const userId = await requireUserId(event)
  const id = idSchema.parse(getRouterParam(event, 'id'))
  return toItemDto(await findItemOr404(userId, id))
})
