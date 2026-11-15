import type { TagDto } from '@omb/shared'

/** The user's tags with how many live items use each, most used first. */
export default defineEventHandler(async (event): Promise<TagDto[]> => {
  const userId = await requireUserId(event)
  const tags = await db.tag.findMany({
    where: { userId, deletedAt: null },
    select: {
      name: true,
      _count: { select: { items: { where: { item: { deletedAt: null } } } } },
    },
  })
  return tags
    .map((t) => ({ name: t.name, count: t._count.items }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
})
