import type {
  CreateItemInput,
  ItemDto,
  ItemKind,
  ItemPage,
  ListItemsQuery,
  ReminderDto,
  ReminderInput,
  TagDto,
  UpdateItemInput,
  UpdateReminderInput,
} from '@omb/shared'

export type KindCounts = Record<ItemKind | 'ALL', number>

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
  }
}
