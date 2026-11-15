import type { Prisma } from '@omb/db'
import { listItemsSchema, type ItemPage } from '@omb/shared'

/** Most search hits we rank. Enough for a personal library; paging walks through this window. */
const SEARCH_WINDOW = 300

/**
 * Lists items, newest capture first, with keyset paging.
 * With `q`, results are ranked by full-text match (prefix per word) plus substring hits, boosted by recency.
 */
export default defineEventHandler(async (event): Promise<ItemPage> => {
  const userId = await requireUserId(event)
  const query = await getValidatedQuery(event, (q) => listItemsSchema.parse(q))

  const where: Prisma.ItemWhereInput = {
    userId,
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.kind && { kind: query.kind }),
    ...(query.tag && { tags: { some: { tag: { name: query.tag } } } }),
  }

  if (query.q) return search(userId, query.q, where, query.cursor, query.limit)

  const after = decodeCursor(query.cursor)
  const items = await db.item.findMany({
    where: after
      ? {
          AND: [
            where,
            {
              OR: [
                { capturedAt: { lt: after.capturedAt } },
                { capturedAt: after.capturedAt, id: { lt: after.id } },
              ],
            },
          ],
        }
      : where,
    include: itemInclude,
    orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
  })
  const page = items.slice(0, query.limit)
  const last = page.at(-1)
  return {
    items: page.map(toItemDto),
    nextCursor: items.length > query.limit && last ? encodeCursor(last.capturedAt, last.id) : null,
  }
})

async function search(
  userId: string,
  q: string,
  where: Prisma.ItemWhereInput,
  cursor: string | undefined,
  limit: number,
): Promise<ItemPage> {
  const words = (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8)
  if (!words.length) return { items: [], nextCursor: null }
  // Only letters and digits reach to_tsquery, so the query syntax can't be broken.
  const tsquery = words.map((w) => `${w}:*`).join(' & ')
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

  const hits = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Item"
    WHERE "userId" = ${userId}::uuid AND "deletedAt" IS NULL
      AND (search @@ to_tsquery('simple', ${tsquery})
        OR title ILIKE ${like} OR body ILIKE ${like} OR quote ILIKE ${like})
    ORDER BY
      ts_rank(search, to_tsquery('simple', ${tsquery}))
        + 0.2 / (1 + EXTRACT(EPOCH FROM now() - "capturedAt") / 86400 / 30) DESC,
      "capturedAt" DESC
    LIMIT ${SEARCH_WINDOW}`
  if (!hits.length) return { items: [], nextCursor: null }

  const order = new Map(hits.map((h, i) => [h.id, i]))
  const matched = await db.item.findMany({
    where: { AND: [where, { id: { in: hits.map((h) => h.id) } }] },
    include: itemInclude,
  })
  matched.sort((a, b) => order.get(a.id)! - order.get(b.id)!)

  const offset = Math.max(0, Number(cursor?.startsWith('o:') ? cursor.slice(2) : 0) || 0)
  const page = matched.slice(offset, offset + limit)
  return {
    items: page.map(toItemDto),
    nextCursor: offset + limit < matched.length ? `o:${offset + limit}` : null,
  }
}

function encodeCursor(capturedAt: Date, id: string): string {
  return Buffer.from(`${capturedAt.toISOString()}|${id}`).toString('base64url')
}

function decodeCursor(cursor: string | undefined): { capturedAt: Date; id: string } | null {
  if (!cursor) return null
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|')
  const capturedAt = new Date(at ?? '')
  if (!id || Number.isNaN(capturedAt.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Bad cursor' })
  }
  return { capturedAt, id }
}
