import type { Prisma } from '@omb/db'
import type { ItemDto, ReminderDto } from '@omb/shared'

/** Relations loaded for every item the API returns. */
export const itemInclude = {
  tags: { include: { tag: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
  reminders: {
    where: { deletedAt: null, status: { in: ['ACTIVE', 'FIRED'] } },
    orderBy: { fireAt: 'asc' },
  },
  review: { select: { nextAt: true, step: true, graduatedAt: true } },
} satisfies Prisma.ItemInclude

export type ItemWithRelations = Prisma.ItemGetPayload<{ include: typeof itemInclude }>

export function toReminderDto(r: ItemWithRelations['reminders'][number]): ReminderDto {
  return {
    id: r.id,
    itemId: r.itemId,
    kind: r.kind,
    status: r.status,
    fireAt: r.fireAt?.toISOString() ?? null,
    rrule: r.rrule,
    timezone: r.timezone,
    isAiSuggested: r.isAiSuggested,
  }
}

export function toItemDto(item: ItemWithRelations): ItemDto {
  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    source: item.source,
    title: item.title,
    titleIsAi: item.titleIsAi,
    body: item.body,
    quote: item.quote,
    url: item.url,
    pageTitle: item.pageTitle,
    favicon: item.favicon,
    aiStatus: item.aiStatus,
    capturedAt: item.capturedAt.toISOString(),
    triagedAt: item.triagedAt?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
    tags: item.tags.map((t) => ({ name: t.tag.name, suggested: t.suggested })),
    reminders: item.reminders.map(toReminderDto),
    attachments: [],
    review:
      item.review && !item.review.graduatedAt
        ? { nextAt: item.review.nextAt.toISOString(), step: item.review.step }
        : null,
  }
}

/** Loads one of the user's items with relations, or a 404. */
export async function findItemOr404(userId: string, id: string): Promise<ItemWithRelations> {
  const item = await db.item.findFirst({
    where: { id, userId, deletedAt: null },
    include: itemInclude,
  })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Item not found' })
  return item
}

/**
 * Makes the item's confirmed tags exactly `names`. Suggested tags that are not in the list are kept
 * as suggestions; listed ones become confirmed.
 */
export async function setItemTags(
  tx: Prisma.TransactionClient,
  userId: string,
  itemId: string,
  names: string[],
) {
  await tx.itemTag.deleteMany({
    where: { itemId, suggested: false, tag: { name: { notIn: names } } },
  })
  for (const name of names) {
    const tag = await tx.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: { deletedAt: null },
      select: { id: true },
    })
    await tx.itemTag.upsert({
      where: { itemId_tagId: { itemId, tagId: tag.id } },
      create: { itemId, tagId: tag.id },
      update: { suggested: false },
    })
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  )
}
