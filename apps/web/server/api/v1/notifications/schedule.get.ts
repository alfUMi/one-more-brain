import { loadSchedule } from '@omb/notify'
import type { AppSchedule } from '@omb/shared'
import { hashScheduleKey, SCHEDULE_KEY_HEADER } from '../../../utils/mobile'

/**
 * What the mobile app schedules as local notifications. The app calls it with its session; its
 * background refresh, which can't reach the secure token store, sends the phone's schedule key.
 * `?test=1` adds a digest due now (Settings › Send a test digest).
 */
export default defineEventHandler(async (event): Promise<AppSchedule> => {
  const key = getRequestHeader(event, SCHEDULE_KEY_HEADER)
  let userId: string
  if (key) {
    const channel = await db.channel.findUnique({
      where: { kind_address: { kind: 'APP', address: hashScheduleKey(key) } },
      select: { id: true, userId: true, enabled: true },
    })
    if (!channel?.enabled) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    userId = channel.userId
    await db.channel.update({ where: { id: channel.id }, data: { lastSeenAt: new Date() } })
  } else {
    userId = await requireUserId(event)
  }
  const test = getQuery(event).test === '1'
  setResponseHeader(event, 'cache-control', 'no-store')
  return loadSchedule(db, userId, new Date(), { test })
})
