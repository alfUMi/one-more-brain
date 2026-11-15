import type { CreateItemInput, ItemDto } from '@omb/shared'

/**
 * The item as it will look once saved, built on the device. Shown right away (optimistic UI) and
 * for captures still waiting in the outbox. `previews` are object URLs of the attached images.
 */
export function localItem(input: CreateItemInput, previews: string[]): ItemDto {
  const now = new Date().toISOString()
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
    pageTitle: null,
    favicon: null,
    extractedText: null,
    aiStatus: 'PENDING',
    capturedAt: new Date(input.capturedAt as Date | string).toISOString(),
    triagedAt: null,
    updatedAt: now,
    tags: (input.tags ?? []).map((name) => ({ name, suggested: false })),
    reminders: input.reminder
      ? [
          {
            id: input.reminder.id,
            itemId: input.id,
            kind: input.reminder.kind,
            status: 'ACTIVE',
            fireAt: (input.reminder.fireAt as Date).toISOString(),
            rrule: input.reminder.rrule ?? null,
            timezone: input.reminder.timezone,
            isAiSuggested: false,
          },
        ]
      : [],
    attachments: previews.map((url, i) => ({
      id: input.attachments?.[i]?.id ?? url,
      kind: 'IMAGE' as const,
      mime: 'image/png',
      sizeBytes: 0,
      width: null,
      height: null,
      url,
    })),
    review: null,
  }
}
