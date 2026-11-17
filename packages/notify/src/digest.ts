import type { PrismaClient } from '@omb/db'
import { localDayStart, onThisDayWindows, toLocal } from '@omb/shared'
import type { messages, DeepStringRecord } from '@omb/shared/i18n'

type Ago = 'week' | 'month' | 'year'
export type DigestStrings = DeepStringRecord<(typeof messages)['en']['digest']>

interface TextFields {
  title: string | null
  body: string | null
  quote: string | null
  pageTitle: string | null
  url: string | null
}

function localDate(now: Date, timeZone: string) {
  try {
    return toLocal(now, timeZone)
  } catch {
    return toLocal(now, 'UTC')
  }
}

/** Short notification title from whatever the item has. */
export function notificationTitle(item: TextFields): string | null {
  const text =
    item.title ?? item.body?.split('\n').find((line) => line.trim()) ?? item.quote ?? item.pageTitle
  const title = text?.trim() || item.url
  if (!title) return null
  return title.length > 120 ? `${title.slice(0, 119)}…` : title
}

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
