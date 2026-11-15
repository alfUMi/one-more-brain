import { fromLocal, toLocal, type TodayDto, type TodayEntry } from '@omb/shared'

const DAY_MS = 86_400_000

export default defineEventHandler(async (event): Promise<TodayDto> => {
  const userId = await requireUserId(event)
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true },
  })
  const now = new Date()
  const l = toLocal(now, user.timezone)
  const tomorrow = new Date(Date.UTC(l.year, l.month - 1, l.day + 1))
  const endOfToday = fromLocal(
    {
      year: tomorrow.getUTCFullYear(),
      month: tomorrow.getUTCMonth() + 1,
      day: tomorrow.getUTCDate(),
      hour: 0,
      minute: 0,
    },
    user.timezone,
  )

  const live = { userId, deletedAt: null, isAiSuggested: false, item: { deletedAt: null } }
  const include = { item: { include: itemInclude } }
  const [missed, upcoming] = await Promise.all([
    db.reminder.findMany({
      where: {
        ...live,
        kind: 'TIME',
        status: 'FIRED',
        lastFiredAt: { gte: new Date(now.getTime() - 7 * DAY_MS) },
        item: { deletedAt: null, status: { in: ['INBOX', 'KEPT'] } },
      },
      include,
      orderBy: { fireAt: 'desc' },
      take: 50,
    }),
    db.reminder.findMany({
      where: {
        ...live,
        status: 'ACTIVE',
        fireAt: { gt: now, lte: new Date(endOfToday.getTime() + 7 * DAY_MS) },
      },
      include,
      orderBy: { fireAt: 'asc' },
      take: 100,
    }),
  ])

  const entry = async (r: (typeof missed)[number]): Promise<TodayEntry> => ({
    reminder: toReminderDto(r),
    item: await toItemDto(r.item),
  })
  return {
    missed: await Promise.all(missed.map(entry)),
    today: await Promise.all(upcoming.filter((r) => r.fireAt! <= endOfToday).map(entry)),
    upcoming: await Promise.all(upcoming.filter((r) => r.fireAt! > endOfToday).map(entry)),
  }
})
