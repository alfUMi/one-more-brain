// Mirrors the Prisma enums in packages/db. Kept here so clients never import the DB package.

export const ITEM_KINDS = ['TEXT', 'LINK', 'HIGHLIGHT', 'VOICE', 'IMAGE'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

export const ITEM_STATUSES = ['INBOX', 'KEPT', 'ARCHIVED', 'DONE'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

export const ITEM_SOURCES = ['WEB', 'EXTENSION', 'MOBILE', 'SHARE_SHEET', 'TELEGRAM'] as const
export type ItemSource = (typeof ITEM_SOURCES)[number]

export const REMINDER_KINDS = ['TIME', 'RECURRING', 'LOCATION'] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]
