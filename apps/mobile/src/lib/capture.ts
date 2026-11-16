import {
  newId,
  type CreateItemInput,
  type ItemDto,
  type ItemSource,
  type ParsedCapture,
} from '@omb/shared'

export interface CaptureDraft {
  parsed: ParsedCapture | null
  /** The reminder phrase the user dismissed ("Ignore this time"). */
  ignoreReminder?: boolean
  /** Remember toggled in the UI (on top of `!remember` in the text). */
  remember?: boolean
  /** A link that came from elsewhere (share sheet), not from the text. */
  url?: string | null
  pageTitle?: string | null
  images: Blob[]
  source: ItemSource
  timeZone: string
}

/** Builds the item to save, plus its images for the outbox. Null when there is nothing to save. */
export function buildCapture(draft: CaptureDraft): {
  input: CreateItemInput
  files: { attachmentId: string; blob: Blob }[]
} | null {
  const p = draft.parsed ?? { body: '', urls: [], tags: [], remember: false, reminder: null }
  const url = draft.url ?? p.urls[0]
  const body = url
    ? p.body
        .replace(url, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    : p.body.trim()
  if (!body && !url && !draft.images.length) return null
  const reminder = draft.ignoreReminder ? null : p.reminder
  const files = draft.images.map((blob) => ({ attachmentId: newId(), blob }))
  const input: CreateItemInput = {
    id: newId(),
    kind: files.length ? 'IMAGE' : url ? 'LINK' : 'TEXT',
    source: draft.source,
    body: body || undefined,
    url: url || undefined,
    pageTitle: draft.pageTitle || undefined,
    tags: p.tags,
    remember: p.remember || Boolean(draft.remember),
    capturedAt: new Date(),
    reminder: reminder
      ? {
          id: newId(),
          kind: reminder.kind,
          fireAt: reminder.fireAt,
          rrule: reminder.rrule,
          timezone: draft.timeZone,
        }
      : undefined,
    attachments: files.map((f) => ({
      id: f.attachmentId,
      kind: 'IMAGE' as const,
      mime: f.blob.type as 'image/png',
    })),
  }
  return { input, files }
}

/** The item as it will look once saved: shown right away and while it waits in the outbox. */
export function localItem(input: CreateItemInput, previews: string[] = []): ItemDto {
  return {
    id: input.id,
    kind: input.kind,
    status: 'INBOX',
    source: input.source,
    title: null,
    titleIsAi: false,
    body: input.body ?? null,
    quote: null,
    url: input.url ?? null,
    pageTitle: input.pageTitle ?? null,
    favicon: null,
    extractedText: null,
    aiStatus: 'PENDING',
    capturedAt: new Date(input.capturedAt as Date | string).toISOString(),
    triagedAt: null,
    updatedAt: new Date().toISOString(),
    tags: (input.tags ?? []).map((name) => ({ name, suggested: false })),
    reminders: input.reminder
      ? [
          {
            id: input.reminder.id,
            itemId: input.id,
            kind: input.reminder.kind,
            status: 'ACTIVE',
            fireAt: new Date(input.reminder.fireAt as Date).toISOString(),
            rrule: input.reminder.rrule ?? null,
            timezone: input.reminder.timezone,
            isAiSuggested: false,
          },
        ]
      : [],
    attachments: previews.map((url, i) => ({
      id: input.attachments?.[i]?.id ?? url,
      kind: 'IMAGE' as const,
      mime: input.attachments?.[i]?.mime ?? 'image/jpeg',
      sizeBytes: 0,
      width: null,
      height: null,
      url,
    })),
    review: null,
  }
}
