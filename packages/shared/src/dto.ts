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
