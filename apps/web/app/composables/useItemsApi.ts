import { newId } from '@omb/shared'
import type {
  AttachmentInput,
  CreateItemInput,
  ItemDto,
  ItemKind,
  ItemPage,
  ListItemsQuery,
  ReminderDto,
  ReminderInput,
  SnoozeInput,
  TagDto,
  TodayDto,
  UpdateItemInput,
  UpdateReminderInput,
} from '@omb/shared'

export type KindCounts = Record<ItemKind | 'ALL', number>

/** Uploads one image for an item (which may not exist yet) and returns it ready to attach. */
async function upload(itemId: string, file: Blob, id: string = newId()): Promise<AttachmentInput> {
  const mime = file.type as AttachmentInput['mime']
  const size = await createImageBitmap(file)
    .then((bmp) => {
      const s = { width: bmp.width, height: bmp.height }
      bmp.close()
      return s
    })
    .catch(() => ({ width: undefined, height: undefined }))
  const { url } = await $fetch<{ url: string }>('/api/v1/uploads', {
    method: 'POST',
    body: { itemId, attachmentId: id, mime, sizeBytes: file.size },
  })
  const res = await fetch(url, { method: 'PUT', body: file, headers: { 'content-type': mime } })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return { id, kind: 'IMAGE', mime, ...size }
}

/** Thin typed wrapper over /api/v1 for items, reminders and tags. */
export function useItemsApi() {
  return {
    list: (query: ListItemsQuery) => $fetch<ItemPage>('/api/v1/items', { query }),
    counts: (status?: string) =>
      $fetch<KindCounts>('/api/v1/items/counts', { query: status ? { status } : {} }),
    get: (id: string) => $fetch<ItemDto>(`/api/v1/items/${id}`),
    create: (input: CreateItemInput) =>
      $fetch<ItemDto>('/api/v1/items', { method: 'POST', body: input }),
    update: (id: string, input: UpdateItemInput) =>
      $fetch<ItemDto>(`/api/v1/items/${id}`, { method: 'PATCH', body: input }),
    remove: (id: string) => $fetch<null>(`/api/v1/items/${id}` as string, { method: 'DELETE' }),
    remember: (id: string) => $fetch<ItemDto>(`/api/v1/items/${id}/review`, { method: 'POST' }),
    addReminder: (itemId: string, input: ReminderInput) =>
      $fetch<ReminderDto>(`/api/v1/items/${itemId}/reminders`, { method: 'POST', body: input }),
    updateReminder: (id: string, input: UpdateReminderInput) =>
      $fetch<ReminderDto>(`/api/v1/reminders/${id}`, { method: 'PATCH', body: input }),
    tags: () => $fetch<TagDto[]>('/api/v1/tags'),
    today: () => $fetch<TodayDto>('/api/v1/today'),
    answerReview: (itemId: string, gotIt: boolean) =>
      $fetch<{ nextAt: string; step: number; graduated: boolean }>(
        `/api/v1/items/${itemId}/review/answer`,
        { method: 'POST', body: { gotIt } },
      ),
    snooze: (id: string, input: SnoozeInput) =>
      $fetch<ReminderDto>(`/api/v1/reminders/${id}/snooze`, { method: 'POST', body: input }),
    upload,
  }
}
