import { fromLocal, toLocal, type ReviewScheduleDto } from '@omb/shared'

/** What the Review page's side column shows: what comes back when, and overall numbers. */
export default defineEventHandler(async (event): Promise<ReviewScheduleDto> => {
  const userId = await requireUserId(event)
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true },
  })
  const now = new Date()
  const l = toLocal(now, user.timezone)
  const dayStart = (offset: number) => {
    const d = new Date(Date.UTC(l.year, l.month - 1, l.day + offset))
    return fromLocal(
      {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: 0,
        minute: 0,
      },
      user.timezone,
    )
  }
  const tomorrow = dayStart(1)
  const dayAfter = dayStart(2)
  const weekEnd = dayStart(7)

  const active = { userId, graduatedAt: null, item: { deletedAt: null } }
  const [dueTomorrow, dueThisWeek, dueLater, inReview, learned, upcoming] = await Promise.all([
    db.review.count({ where: { ...active, nextAt: { gte: tomorrow, lt: dayAfter } } }),
    db.review.count({ where: { ...active, nextAt: { gte: dayAfter, lt: weekEnd } } }),
    db.review.count({ where: { ...active, nextAt: { gte: weekEnd } } }),
    db.review.count({ where: active }),
    db.review.count({ where: { userId, graduatedAt: { not: null }, item: { deletedAt: null } } }),
    db.review.findMany({
      where: { ...active, nextAt: { gt: now } },
      orderBy: { nextAt: 'asc' },
      take: 5,
      select: {
        nextAt: true,
        item: { select: { id: true, title: true, body: true, quote: true, url: true } },
      },
    }),
  ])

  return {
    dueTomorrow,
    dueThisWeek,
    dueLater,
    inReview,
    learned,
    upcoming: upcoming.map((r) => ({
      itemId: r.item.id,
      text: r.item.title ?? r.item.quote ?? r.item.body ?? r.item.url ?? '',
      nextAt: r.nextAt.toISOString(),
    })),
  }
})
