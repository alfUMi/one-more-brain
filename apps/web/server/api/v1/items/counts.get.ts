import { ITEM_KINDS, ITEM_STATUSES, type ItemKind } from '@omb/shared'
import { z } from 'zod'

const querySchema = z.object({ status: z.enum(ITEM_STATUSES).optional() })

/** Live item counts per kind (plus ALL), optionally for one status. Feeds the kind filter. */
export default defineEventHandler(async (event): Promise<Record<ItemKind | 'ALL', number>> => {
  const userId = await requireUserId(event)
  const { status } = await getValidatedQuery(event, (q) => querySchema.parse(q))
  const groups = await db.item.groupBy({
    by: ['kind'],
    where: { userId, deletedAt: null, ...(status && { status }) },
    _count: { _all: true },
  })
  const counts = Object.fromEntries([['ALL', 0], ...ITEM_KINDS.map((k) => [k, 0])]) as Record<
    ItemKind | 'ALL',
    number
  >
  for (const g of groups) {
    counts[g.kind] = g._count._all
    counts.ALL += g._count._all
  }
  return counts
})
