import { fromLocal, toLocal, type TodayDto, type TodayEntry, type TodayState } from '@omb/shared'

const DAY_MS = 86_400_000

/** Start of a local calendar day, `days` from today (negative = past), in `timeZone`. */
function localDayStart(now: Date, timeZone: string, days: number, months = 0, years = 0): Date {
  const l = toLocal(now, timeZone)
  const year = l.year + years
  const month0 = l.month - 1 + months
  // Clamp the day so "a month ago" from 31 March is 28/29 February, not 3 March.
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  const d = new Date(Date.UTC(year, month0, Math.min(l.day, lastDay) + days))
  return fromLocal(
    {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: 0,
      minute: 0,
    },
    timeZone,
  )
}

export default defineEventHandler(async (event): Promise<TodayDto> => {
  const userId = await requireUserId(event)
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true },
  })
  const tz = user.timezone
  const now = new Date()
  const startOfToday = localDayStart(now, tz, 0)
  const endOfToday = localDayStart(now, tz, 1)

  const live = { userId, deletedAt: null, isAiSuggested: false, item: { deletedAt: null } }
  const withItem = { item: { include: itemInclude } }

  const [todays, missed, reviews, reviewsDue, inboxCount, oldest, ...onThisDay] = await Promise.all(
    [
      // Everything scheduled for today, including what was already done or has fired.
      db.reminder.findMany({
        where: {
          ...live,
          OR: [
            { fireAt: { gte: startOfToday, lt: endOfToday } },
            // Recurring reminders that fired today have already moved on to their next date.
            { kind: 'RECURRING', lastFiredAt: { gte: startOfToday, lt: endOfToday } },
          ],
          status: { in: ['ACTIVE', 'FIRED', 'DONE'] },
        },
        include: withItem,
        take: 100,
      }),
      // One-off reminders from the past week that fired and were never dealt with.
      db.reminder.findMany({
        where: {
          ...live,
          kind: 'TIME',
          status: 'FIRED',
          fireAt: { gte: new Date(now.getTime() - 7 * DAY_MS), lt: startOfToday },
          item: { deletedAt: null, status: { in: ['INBOX', 'KEPT'] } },
        },
        include: withItem,
        orderBy: { fireAt: 'asc' },
        take: 20,
      }),
      db.review.findMany({
        where: { userId, graduatedAt: null, nextAt: { lte: now }, item: { deletedAt: null } },
        include: withItem,
        orderBy: { nextAt: 'asc' },
        take: 20,
      }),
      db.review.count({
        where: { userId, graduatedAt: null, nextAt: { lte: now }, item: { deletedAt: null } },
      }),
      db.item.count({ where: { userId, deletedAt: null, status: 'INBOX' } }),
      db.item.findFirst({
        where: { userId, deletedAt: null, status: 'INBOX' },
        orderBy: { capturedAt: 'asc' },
        select: { capturedAt: true },
      }),
      ...(
        [
          ['week', localDayStart(now, tz, -7)],
          ['month', localDayStart(now, tz, 0, -1)],
          ['year', localDayStart(now, tz, 0, 0, -1)],
        ] as const
      ).map(async ([ago, start]) => {
        const item = await db.item.findFirst({
          where: {
            userId,
            deletedAt: null,
            status: { not: 'DONE' },
            capturedAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) },
          },
          include: itemInclude,
          orderBy: { capturedAt: 'asc' },
        })
        return item ? { ago, item: await toItemDto(item) } : null
      }),
    ],
  )

  /** When the reminder sits on today's timeline. */
  const timeOf = (r: (typeof todays)[number]) =>
    r.kind === 'RECURRING' && r.lastFiredAt && r.lastFiredAt >= startOfToday
      ? r.lastFiredAt
      : r.fireAt!
  const today = [...todays].sort((a, b) => timeOf(a).getTime() - timeOf(b).getTime())

  let nextAssigned = false
  const stateOf = (r: (typeof todays)[number]): TodayState => {
    if (r.status === 'DONE') return 'done'
    if (r.kind === 'RECURRING' && timeOf(r) <= now) return 'past'
    if (timeOf(r) <= now) return 'missed'
    if (!nextAssigned) {
      nextAssigned = true
      return 'next'
    }
    return 'later'
  }

  const entry = async (r: (typeof todays)[number], state: TodayState): Promise<TodayEntry> => ({
    reminder: { ...toReminderDto(r), fireAt: timeOf(r).toISOString() },
    item: await toItemDto(r.item),
    state,
  })

  return {
    reminders: [
      ...(await Promise.all(missed.map((r) => entry(r, 'missed')))),
      ...(await Promise.all(today.map((r) => entry(r, stateOf(r))))),
    ],
    reviews: await Promise.all(
      reviews.map(async (r) => ({
        item: await toItemDto(r.item),
        step: r.step,
        lapses: r.lapses,
        nextAt: r.nextAt.toISOString(),
      })),
    ),
    reviewsDue,
    onThisDay: onThisDay.filter((x) => x !== null),
    inbox: { count: inboxCount, oldestCapturedAt: oldest?.capturedAt.toISOString() ?? null },
  }
})
