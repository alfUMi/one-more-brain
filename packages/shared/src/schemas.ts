import { z } from 'zod'
import { ACCENTS, THEMES } from './appearance'
import { ITEM_KINDS, ITEM_SOURCES, ITEM_STATUSES } from './enums'

/** Client-generated UUIDv7, so offline captures are idempotent. */
export const idSchema = z.uuid({ version: 'v7' })

const tagName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[\p{L}\p{N}_-]{1,40}$/u, 'Tags are 1-40 letters, digits, "-" or "_"')

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
  })
  .refine(
    (item) => item.body || item.quote || item.url || item.kind === 'VOICE' || item.kind === 'IMAGE',
    {
      message: 'An item needs text, a quote, a URL or an attachment',
    },
  )
export type CreateItemInput = z.input<typeof createItemSchema>

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
  timezone: z
    .string()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz })
        return true
      } catch {
        return false
      }
    }, 'Unknown time zone')
    .optional(),
  digestTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm')
    .optional(),
  digestEnabled: z.boolean().optional(),
  theme: z.enum(THEMES).optional(),
  accent: z.enum(ACCENTS).optional(),
})
export type UpdateMeInput = z.input<typeof updateMeSchema>
