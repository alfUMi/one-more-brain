import { fromPrisma, QUEUES, type NotifyDigestJob, type PrismaClient } from '@omb/db'
import { canDeliver, composeDigest, loadDigest, sendToChannel } from '@omb/notify'
import { PUSH_CHANNEL_KINDS, toLocal, type DigestPushPayload } from '@omb/shared'
import { messages } from '@omb/shared/i18n'
import type { Job, PgBoss } from 'pg-boss'
import { log } from './log'

export { composeDigest, loadDigest, type DigestContent } from '@omb/notify'

/** A digest that is more than this late (worker down all morning) is skipped, not sent at noon. */
export const DIGEST_LATE_MINUTES = 180

// ───────────────────────── When ─────────────────────────

function localDate(now: Date, timeZone: string) {
  try {
    return toLocal(now, timeZone)
  } catch {
    return toLocal(now, 'UTC')
  }
}

const dateKey = (l: { year: number; month: number; day: number }) =>
  `${l.year}-${String(l.month).padStart(2, '0')}-${String(l.day).padStart(2, '0')}`

/**
 * Whether a user's digest is due at `now`: `wait` (not yet, or already sent today), `send`,
 * or `skip` (today's time passed long ago; mark the day done without sending).
 */
export function digestDue(
  now: Date,
  user: { timezone: string; digestTime: string; lastDigestOn: Date | null },
): 'wait' | 'send' | 'skip' {
  const l = localDate(now, user.timezone)
  if (user.lastDigestOn && user.lastDigestOn.toISOString().slice(0, 10) >= dateKey(l)) return 'wait'
  const [h = 8, m = 0] = user.digestTime.split(':').map(Number)
  const late = l.hour * 60 + l.minute - (h * 60 + m)
  if (late < 0) return 'wait'
  return late <= DIGEST_LATE_MINUTES ? 'send' : 'skip'
}

/**
 * Claims every user whose digest is due: sets `lastDigestOn` to their local today and enqueues the
 * digest in the same transaction, so each day's digest is queued exactly once.
 */
export async function scanDigests(db: PrismaClient, boss: PgBoss, now = new Date()) {
  return db.$transaction(async (tx) => {
    // A local date is at most one day ahead of UTC, so anyone marked after today (UTC) is done.
    const candidates = await tx.$queryRaw<
      { id: string; timezone: string; digestTime: string; lastDigestOn: Date | null }[]
    >`
      SELECT id, timezone, "digestTime", "lastDigestOn"
      FROM "User"
      WHERE "digestEnabled"
        AND ("lastDigestOn" IS NULL OR "lastDigestOn" <= (${now}::timestamptz AT TIME ZONE 'UTC')::date)
      LIMIT 1000
      FOR UPDATE SKIP LOCKED`

    let queued = 0
    for (const user of candidates) {
      const due = digestDue(now, user)
      if (due === 'wait') continue
      const l = localDate(now, user.timezone)
      await tx.user.update({
        where: { id: user.id },
        data: { lastDigestOn: new Date(Date.UTC(l.year, l.month - 1, l.day)) },
      })
      if (due === 'skip') continue
      const job: NotifyDigestJob = { userId: user.id, since: now.toISOString() }
      await boss.send(QUEUES.notifyDigest, job, {
        db: fromPrisma(tx),
        retryLimit: 5,
        retryDelay: 30,
        retryBackoff: true,
      })
      queued++
    }
    return queued
  })
}

// ───────────────────────── Delivery ─────────────────────────

/** pg-boss handler: builds the digest and sends it to every enabled Web Push channel once (the app schedules its own). */
export function notifyDigest(db: PrismaClient) {
  return async (jobs: Job<NotifyDigestJob>[]) => {
    for (const job of jobs) await deliver(db, job.data)
  }
}

async function deliver(db: PrismaClient, { userId, since, test }: NotifyDigestJob) {
  const now = new Date()
  const [user, channels, alreadySent] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, locale: true, timezone: true, digestEnabled: true },
    }),
    db.channel.findMany({
      where: { userId, kind: { in: [...PUSH_CHANNEL_KINDS] }, enabled: true },
    }),
    db.delivery.findMany({
      where: { userId, type: 'DIGEST', status: 'SENT', sentAt: { gte: new Date(since) } },
      select: { channelId: true },
    }),
  ])
  if (!user || (!user.digestEnabled && !test)) return
  const sent = new Set(alreadySent.map((d) => d.channelId))
  const pending = channels.filter((c) => !sent.has(c.id) && canDeliver(c))
  if (!pending.length) return

  const t = messages[user.locale === 'ru' ? 'ru' : 'en'].digest
  const content = await loadDigest(db, user, now)
  const text = composeDigest(content, t, now, test)
  if (!text) {
    log.info('digest skipped: nothing to say', { userId })
    return
  }
  const payload: DigestPushPayload = {
    type: 'digest',
    ...text,
    tag: 'digest',
    url: '/today',
    reviewItemId: content.review?.itemId ?? null,
    actions: content.review
      ? [
          { action: 'review-got', title: t.gotIt },
          { action: 'review-forgot', title: t.forgot },
        ]
      : [],
  }

  let retry = false
  for (const channel of pending) {
    const result = await sendToChannel(channel, payload)
    await db.delivery.create({
      data: {
        userId,
        channelId: channel.id,
        type: 'DIGEST',
        status: result.status,
        error: result.status === 'SENT' ? null : result.error,
      },
    })
    if (result.status === 'EXPIRED') {
      await db.channel.update({ where: { id: channel.id }, data: { enabled: false } })
    }
    if (result.status === 'FAILED') retry = true
    log.info('digest push', { userId, channelId: channel.id, status: result.status })
  }
  if (retry) throw new Error(`Digest push failed for user ${userId}; retrying`)
}
