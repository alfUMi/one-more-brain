import { z } from 'zod'
import { ACCENTS, THEMES } from './appearance'
import { ITEM_KINDS, ITEM_SOURCES, ITEM_STATUSES } from './enums'
import { parseRrule } from './recurrence'
import { isValidTimeZone } from './time'

/** Client-generated UUIDv7, so offline captures are idempotent. */
export const idSchema = z.uuid({ version: 'v7' })

const timeZone = z.string().refine(isValidTimeZone, 'Unknown time zone')

const tagName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[\p{L}\p{N}_-]{1,40}$/u, 'Tags are 1-40 letters, digits, "-" or "_"')

export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export type ImageMime = (typeof IMAGE_MIMES)[number]
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** Asks for a presigned upload URL for one attachment of an item that may not exist yet. */
export const createUploadSchema = z.object({
  itemId: idSchema,
  attachmentId: idSchema,
  mime: z.enum(IMAGE_MIMES),
  sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
})
export type CreateUploadInput = z.input<typeof createUploadSchema>

/** An uploaded file, attached when the item is created. */
export const attachmentInputSchema = z.object({
  id: idSchema,
  kind: z.enum(['IMAGE', 'SCREENSHOT']),
  mime: z.enum(IMAGE_MIMES),
  width: z.number().int().positive().max(100_000).optional(),
  height: z.number().int().positive().max(100_000).optional(),
})
export type AttachmentInput = z.input<typeof attachmentInputSchema>

/** A time or recurring reminder. Ids come from the client, like items. */
export const reminderInputSchema = z
  .object({
    id: idSchema,
    kind: z.enum(['TIME', 'RECURRING']),
    fireAt: z.coerce.date(),
    rrule: z.string().max(200).optional(),
    timezone: timeZone,
  })
  .refine((r) => (r.kind === 'RECURRING' ? r.rrule && parseRrule(r.rrule) : !r.rrule), {
    message: 'Recurring reminders need a supported rrule; one-off reminders must not have one',
    path: ['rrule'],
  })
export type ReminderInput = z.input<typeof reminderInputSchema>

export const createItemSchema = z
  .object({
    id: idSchema,
    kind: z.enum(ITEM_KINDS),
    source: z.enum(ITEM_SOURCES),
    title: z.string().trim().max(300).optional(),
    body: z.string().max(50_000).optional(),
    quote: z.string().max(20_000).optional(),
    url: z.url().max(2_000).optional(),
    pageTitle: z.string().max(500).optional(),
    tags: z.array(tagName).max(20).default([]),
    capturedAt: z.coerce.date(),
    reminder: reminderInputSchema.optional(),
    /** Add to spaced repetition right away. */
    remember: z.boolean().default(false),
    attachments: z.array(attachmentInputSchema).max(10).default([]),
  })
  .refine((item) => item.body || item.quote || item.url || item.attachments.length > 0, {
    message: 'An item needs text, a quote, a URL or an attachment',
  })
export type CreateItemInput = z.input<typeof createItemSchema>

export const updateReminderSchema = z.object({
  fireAt: z.coerce.date().optional(),
  status: z.enum(['ACTIVE', 'DONE', 'CANCELLED']).optional(),
  /** Accept an AI-suggested reminder so it starts firing. */
  accept: z.literal(true).optional(),
})
export type UpdateReminderInput = z.input<typeof updateReminderSchema>

export const updateItemSchema = z.object({
  title: z.string().trim().max(300).nullable().optional(),
  body: z.string().max(50_000).nullable().optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  tags: z.array(tagName).max(20).optional(),
})
export type UpdateItemInput = z.input<typeof updateItemSchema>

export const updateMeSchema = z.object({
  name: z.string().trim().max(100).optional(),
  locale: z.enum(['en', 'ru']).optional(),
  timezone: timeZone.optional(),
  digestTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm')
    .optional(),
  digestEnabled: z.boolean().optional(),
  theme: z.enum(THEMES).optional(),
  accent: z.enum(ACCENTS).optional(),
})
export type UpdateMeInput = z.input<typeof updateMeSchema>

export const listItemsSchema = z.object({
  status: z.enum(ITEM_STATUSES).optional(),
  kind: z.enum(ITEM_KINDS).optional(),
  tag: tagName.optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})
export type ListItemsQuery = z.input<typeof listItemsSchema>

export const SNOOZE_PRESETS = ['10m', '1h', 'tonight', 'tomorrow'] as const
export type SnoozePreset = (typeof SNOOZE_PRESETS)[number]

/** Snooze to a preset (resolved in the user's time zone) or an exact time. */
export const snoozeSchema = z.union([
  z.object({ preset: z.enum(SNOOZE_PRESETS) }),
  z.object({ until: z.coerce.date() }),
])
export type SnoozeInput = z.input<typeof snoozeSchema>

/** A browser's Web Push subscription (PushSubscription.toJSON()). */
export const webPushChannelSchema = z.object({
  endpoint: z.url().max(2_000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  label: z.string().trim().max(100).optional(),
})
export type WebPushChannelInput = z.input<typeof webPushChannelSchema>
