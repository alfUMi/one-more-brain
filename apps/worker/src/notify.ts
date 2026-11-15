import type { NotifyReminderJob, PrismaClient } from '@omb/db'
import { sendWebPush, type WebPushTarget } from '@omb/notify'
import type { PushPayload } from '@omb/shared'
import { messages } from '@omb/shared/i18n'
import type { Job } from 'pg-boss'
import { log } from './log'

/** Short notification title from whatever the item has. */
export function notificationTitle(item: {
  title: string | null
  body: string | null
  quote: string | null
  pageTitle: string | null
  url: string | null
}): string | null {
  const text =
    item.title ?? item.body?.split('\n').find((line) => line.trim()) ?? item.quote ?? item.pageTitle
  const title = text?.trim() || item.url
  if (!title) return null
  return title.length > 120 ? `${title.slice(0, 119)}…` : title
}

/**
 * Delivers a fired reminder to each enabled Web Push channel and records a Delivery per channel.
 * Throws when a channel failed for a retryable reason, so pg-boss retries; channels that already
 * got this occurrence are skipped on the retry.
 */
export function notifyReminder(db: PrismaClient) {
  return async (jobs: Job<NotifyReminderJob>[]) => {
    for (const job of jobs) await deliver(db, job.data)
  }
}

async function deliver(db: PrismaClient, { reminderId, firedAt }: NotifyReminderJob) {
  const reminder = await db.reminder.findUnique({
    where: { id: reminderId },
    include: {
      item: {
        select: {
          id: true,
          title: true,
          body: true,
          quote: true,
          pageTitle: true,
          url: true,
          deletedAt: true,
        },
      },
    },
  })
  if (
    !reminder ||
    reminder.deletedAt ||
    reminder.status === 'CANCELLED' ||
    reminder.item.deletedAt
  ) {
    return
  }

  const [user, channels, alreadySent] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: reminder.userId }, select: { locale: true } }),
    db.channel.findMany({ where: { userId: reminder.userId, kind: 'WEB_PUSH', enabled: true } }),
    db.delivery.findMany({
      where: { reminderId, status: 'SENT', sentAt: { gte: new Date(firedAt) } },
      select: { channelId: true },
    }),
  ])
  const t = messages[user.locale === 'ru' ? 'ru' : 'en'].notify
  const payload: PushPayload = {
    type: 'reminder',
    title: notificationTitle(reminder.item) ?? t.untitled,
    body: t.reminder,
    tag: `item-${reminder.item.id}`,
    url: `/?item=${reminder.item.id}`,
    reminderId,
    itemId: reminder.item.id,
    actions: [
      { action: 'done', title: t.done },
      { action: 'snooze-1h', title: t.snooze1h },
      { action: 'snooze-tomorrow', title: t.tomorrow },
    ],
  }

  const sent = new Set(alreadySent.map((d) => d.channelId))
  let retry = false
  for (const channel of channels) {
    if (sent.has(channel.id)) continue
    const result = await sendWebPush(
      { endpoint: channel.address, keys: channel.keys as WebPushTarget['keys'] },
      payload,
    )
    await db.delivery.create({
      data: {
        userId: reminder.userId,
        channelId: channel.id,
        reminderId,
        type: 'REMINDER',
        status: result.status,
        error: result.status === 'SENT' ? null : result.error,
      },
    })
    if (result.status === 'EXPIRED') {
      await db.channel.update({ where: { id: channel.id }, data: { enabled: false } })
    }
    if (result.status === 'FAILED') retry = true
    log.info('push', { reminderId, channelId: channel.id, status: result.status })
  }
  if (retry) throw new Error(`Push failed for reminder ${reminderId}; retrying`)
}
