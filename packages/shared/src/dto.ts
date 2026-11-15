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
export interface PushPayload {
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

/** Review page side column: when cards come back, and overall numbers. */
export interface ReviewScheduleDto {
  dueTomorrow: number
  /** After tomorrow, within the next 7 days. */
  dueThisWeek: number
  dueLater: number
  /** Cards still being learned. */
  inReview: number
  /** Cards past the last interval. */
  learned: number
  upcoming: { itemId: string; text: string; nextAt: string }[]
}
