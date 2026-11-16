import { fromPrisma, QUEUES, type NotifyDigestJob, type PrismaClient } from '@omb/db'
import { canDeliver, sendToChannel } from '@omb/notify'
import {
  localDayStart,
  onThisDayWindows,
  NOTIFY_CHANNEL_KINDS,
  toLocal,
  type DigestPushPayload,
} from '@omb/shared'
import { messages, type DeepStringRecord } from '@omb/shared/i18n'
import type { Job, PgBoss } from 'pg-boss'
import { log } from './log'
import { notificationTitle } from './notify'

/** A digest that is more than this late (worker down all morning) is skipped, not sent at noon. */
export const DIGEST_LATE_MINUTES = 180

type Ago = 'week' | 'month' | 'year'
type DigestStrings = DeepStringRecord<(typeof messages)['en']['digest']>

interface TextFields {
  title: string | null
  body: string | null
  quote: string | null
  pageTitle: string | null
  url: string | null
}

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

// ───────────────────────── What ─────────────────────────

export interface DigestContent {
  /** Today's reminders still to come, in order: local "HH:MM" and the item's text. */
  reminders: { time: string; text: string }[]
  inbox: { count: number; oldestCapturedAt: Date | null }
  reviewsDue: number
  /** The first review card due; Got it / Forgot answer it from the notification. */
  review: { itemId: string; text: string } | null
  /** A random kept note, shown when no review is due. */
  pastNote: string | null
  onThisDay: { ago: Ago; text: string } | null
}

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))

function age(since: Date, now: Date, t: DigestStrings) {
  const hours = Math.max(1, Math.floor((now.getTime() - since.getTime()) / 3_600_000))
  return hours < 24 ? fill(t.hours, { n: hours }) : fill(t.days, { n: Math.floor(hours / 24) })
}

/** The notification text, or null when there is nothing worth sending (unless it's a test). */
export function composeDigest(
  c: DigestContent,
  t: DigestStrings,
  now: Date,
  test = false,
): { title: string; body: string } | null {
  const lines: string[] = []
  if (c.reminders.length) {
    const shown = c.reminders.slice(0, 3).map((r) => `${r.time} ${clip(r.text, 40)}`)
    if (c.reminders.length > 3) shown.push(fill(t.more, { n: c.reminders.length - 3 }))
    lines.push(fill(t.reminders, { list: shown.join(' · ') }))
  }
  if (c.inbox.count === 1) lines.push(t.inboxOne)
  else if (c.inbox.count > 1) {
    const oldest = c.inbox.oldestCapturedAt
    lines.push(fill(t.inbox, { n: c.inbox.count, age: oldest ? age(oldest, now, t) : '' }))
  }
  if (c.reviewsDue > 1) lines.push(fill(t.reviews, { n: c.reviewsDue }))
  if (c.review) lines.push(fill(t.rememberThis, { text: clip(c.review.text, 90) }))
  else if (c.pastNote) lines.push(fill(t.fromPast, { text: clip(c.pastNote, 90) }))
  if (c.onThisDay) lines.push(`${t.ago[c.onThisDay.ago]}: ${clip(c.onThisDay.text, 70)}`)

  if (!lines.length) {
    if (!test) return null
    lines.push(t.nothing)
  }
  return { title: test ? t.testTitle : t.title, body: lines.join('\n') }
}

/** What the review card shows: the quote for highlights, else the usual title. */
const cardText = (item: TextFields) => item.quote ?? notificationTitle(item)

const textSelect = { title: true, body: true, quote: true, pageTitle: true, url: true } as const

export async function loadDigest(
  db: PrismaClient,
  user: { id: string; timezone: string },
  now: Date,
): Promise<DigestContent> {
  const userId = user.id
  const tz = user.timezone
  const endOfToday = localDayStart(now, tz, 1)
  const dueReview = { userId, graduatedAt: null, nextAt: { lte: now }, item: { deletedAt: null } }

  const [reminders, inboxCount, oldest, reviewsDue, review, ...past] = await Promise.all([
    db.reminder.findMany({
      where: {
        userId,
        deletedAt: null,
        isAiSuggested: false,
        status: 'ACTIVE',
        fireAt: { gte: now, lt: endOfToday },
        item: { deletedAt: null },
      },
      select: { fireAt: true, item: { select: textSelect } },
      orderBy: { fireAt: 'asc' },
      take: 20,
    }),
    db.item.count({ where: { userId, deletedAt: null, status: 'INBOX' } }),
    db.item.findFirst({
      where: { userId, deletedAt: null, status: 'INBOX' },
      orderBy: { capturedAt: 'asc' },
      select: { capturedAt: true },
    }),
    db.review.count({ where: dueReview }),
    db.review.findFirst({
      where: dueReview,
      orderBy: { nextAt: 'asc' },
      select: { itemId: true, item: { select: textSelect } },
    }),
    ...onThisDayWindows(now, tz).map(async ({ ago, start, end }) => {
      const item = await db.item.findFirst({
        where: {
          userId,
          deletedAt: null,
          status: { not: 'DONE' },
          capturedAt: { gte: start, lt: end },
        },
        orderBy: { capturedAt: 'asc' },
        select: textSelect,
      })
      const text = item && notificationTitle(item)
      return text ? { ago, text } : null
    }),
  ])

  let pastNote: string | null = null
  if (!review) {
    const [kept] = await db.$queryRaw<TextFields[]>`
      SELECT title, body, quote, "pageTitle", url FROM "Item"
      WHERE "userId" = ${userId}::uuid AND status = 'KEPT' AND "deletedAt" IS NULL
      ORDER BY random() LIMIT 1`
    pastNote = kept ? cardText(kept) : null
  }

  const time = (d: Date) => {
    const l = localDate(d, tz)
    return `${String(l.hour).padStart(2, '0')}:${String(l.minute).padStart(2, '0')}`
  }
  const reviewText = review && cardText(review.item)
  return {
    reminders: reminders.flatMap((r) => {
      const text = notificationTitle(r.item)
      return text && r.fireAt ? [{ time: time(r.fireAt), text }] : []
    }),
    inbox: { count: inboxCount, oldestCapturedAt: oldest?.capturedAt ?? null },
    reviewsDue,
    review: review && reviewText ? { itemId: review.itemId, text: reviewText } : null,
    pastNote,
    // The year-old note is the most surprising, so it wins.
    onThisDay: past.filter((x) => x !== null).at(-1) ?? null,
  }
}

// ───────────────────────── Delivery ─────────────────────────

/** pg-boss handler: builds the digest and sends it to every enabled push channel once. */
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
      where: { userId, kind: { in: [...NOTIFY_CHANNEL_KINDS] }, enabled: true },
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
