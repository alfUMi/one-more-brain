import type { ItemKind, ItemSource, ItemStatus, ReminderKind } from './enums'

/** API response shapes. Dates are ISO strings on the wire. */

export interface ItemTagDto {
  name: string
  /** AI-suggested and not yet confirmed (shown dimmed). */
  suggested: boolean
}

export interface ReminderDto {
  id: string
  itemId: string
  kind: ReminderKind
  status: 'ACTIVE' | 'FIRED' | 'DONE' | 'CANCELLED'
  fireAt: string | null
  rrule: string | null
  timezone: string
  isAiSuggested: boolean
}

export interface AttachmentDto {
  id: string
  kind: 'IMAGE' | 'SCREENSHOT' | 'AUDIO'
  mime: string
  sizeBytes: number
  width: number | null
  height: number | null
  /** Short-lived presigned GET URL. */
  url: string
}

export interface ItemDto {
  id: string
  kind: ItemKind
  status: ItemStatus
  source: ItemSource
  title: string | null
  titleIsAi: boolean
  body: string | null
  quote: string | null
  url: string | null
  pageTitle: string | null
  favicon: string | null
  /** Text the AI read from the item's images. */
  extractedText: string | null
  aiStatus: 'PENDING' | 'DONE' | 'FAILED' | 'SKIPPED'
  capturedAt: string
  triagedAt: string | null
  updatedAt: string
  tags: ItemTagDto[]
  reminders: ReminderDto[]
  attachments: AttachmentDto[]
  review: { nextAt: string; step: number } | null
}

export interface ItemPage {
  items: ItemDto[]
  nextCursor: string | null
}

export interface TagDto {
  name: string
  count: number
}

/** What the service worker receives in a push message. */
export interface ReminderPushPayload {
  type: 'reminder'
  title: string
  body: string
  /** Groups notifications: a new one for the same item replaces the old one. */
  tag: string
  /** Page to open on click. */
  url: string
  reminderId: string
  itemId: string
  actions: { action: 'done' | 'snooze-1h' | 'snooze-tomorrow'; title: string }[]
}

/** The daily digest. Got it / Forgot answer the review card it shows (`reviewItemId`). */
export interface DigestPushPayload {
  type: 'digest'
  title: string
  body: string
  tag: 'digest'
  url: string
  reviewItemId: string | null
  actions: { action: 'review-got' | 'review-forgot'; title: string }[]
}

export type PushPayload = ReminderPushPayload | DigestPushPayload

/**
 * What the mobile app schedules as local notifications on the phone (no push service involved).
 * `key` names one occurrence, so the app and its background refresh never show it twice.
 */
export interface AppSchedule {
  generatedAt: string
  reminders: { key: string; reminderId: string; itemId: string; at: string; title: string }[]
  /** The next daily digest, with today's content as it stands now; null when off or empty. */
  digest: {
    key: string
    at: string
    title: string
    body: string
    reviewItemId: string | null
  } | null
  /** The reminder body text in the user's language (the background runner has no i18n). */
  reminderBody: string
}

/** Where a reminder stands within today (Today › Reminders panel). */
/** past = a recurring reminder that already fired today and moved on to its next date. */
export type TodayState = 'done' | 'past' | 'missed' | 'next' | 'later'

export interface TodayEntry {
  reminder: ReminderDto
  item: ItemDto
  state: TodayState
}

export interface ReviewCardDto {
  item: ItemDto
  step: number
  lapses: number
  nextAt: string
}

export interface OnThisDayEntry {
  ago: 'week' | 'month' | 'year'
  item: ItemDto
}

/** Everything the Today page and the Inbox side column show, in the user's time zone. */
export interface TodayDto {
  /** Today's reminders in time order, plus missed ones from the last week first. */
  reminders: TodayEntry[]
  /** Reviews due now, oldest first (at most 20 cards). */
  reviews: ReviewCardDto[]
  reviewsDue: number
  onThisDay: OnThisDayEntry[]
  inbox: { count: number; oldestCapturedAt: string | null }
}
