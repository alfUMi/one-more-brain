/** Browsers subscribed to this user's reminders (Settings › Devices). */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const channels = await db.channel.findMany({
    where: { userId, kind: 'WEB_PUSH' },
    select: { id: true, label: true, enabled: true, lastSeenAt: true, createdAt: true },
    orderBy: { lastSeenAt: 'desc' },
  })
  return channels.map((c) => ({
    ...c,
    lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }))
})
