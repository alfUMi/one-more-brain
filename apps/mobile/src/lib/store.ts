import type { ItemDto, ItemStatus, TagDto, TodayDto } from '@omb/shared'
import { reactive } from 'vue'
import { cacheGet, cachePut, readJson, writeJson } from './prefs'
import { api, session } from './session'

/**
 * What the screens show, shared between tabs. Every list is also cached on the phone, so the app
 * opens with the last copy offline (`cachedAt` says how old it is).
 */
export const store = reactive({
  online: true,
  inbox: [] as ItemDto[],
  inboxLoaded: false,
  inboxCachedAt: null as number | null,
  today: null as TodayDto | null,
  todayCachedAt: null as number | null,
  tags: [] as TagDto[],
  /** The last notes captured on this phone ("Just captured"). */
  recent: [] as ItemDto[],
  /** When the lists last came from the server. */
  syncedAt: null as number | null,
})

const userId = () => session.profile?.id ?? ''

export async function loadInbox() {
  const id = userId()
  if (!id) return
  try {
    const page = await api.list({ status: 'INBOX', limit: 100 })
    store.inbox = page.items
    store.inboxCachedAt = null
    store.syncedAt = Date.now()
    await cachePut(id, 'inbox', page.items)
  } catch {
    const cached = await cacheGet<ItemDto[]>(id, 'inbox')
    if (cached && !store.inboxLoaded) {
      store.inbox = cached.data
      store.inboxCachedAt = cached.savedAt
    } else if (cached) store.inboxCachedAt = cached.savedAt
  } finally {
    store.inboxLoaded = true
  }
}

export async function loadToday() {
  const id = userId()
  if (!id) return
  try {
    store.today = await api.today()
    store.todayCachedAt = null
    store.syncedAt = Date.now()
    await cachePut(id, 'today', store.today)
  } catch {
    const cached = await cacheGet<TodayDto>(id, 'today')
    if (cached) {
      store.today ??= cached.data
      store.todayCachedAt = cached.savedAt
    }
  }
}

export async function loadTags() {
  const id = userId()
  if (!id) return
  try {
    store.tags = await api.tags()
    await cachePut(id, 'tags', store.tags)
  } catch {
    store.tags = (await cacheGet<TagDto[]>(id, 'tags'))?.data ?? store.tags
  }
}

/** Shows cached copies right away, then refreshes everything from the server. */
export async function loadAll() {
  const id = userId()
  if (!id) return
  if (!store.inboxLoaded) {
    const [inbox, today, tags, recent] = await Promise.all([
      cacheGet<ItemDto[]>(id, 'inbox'),
      cacheGet<TodayDto>(id, 'today'),
      cacheGet<TagDto[]>(id, 'tags'),
      readJson<ItemDto[]>(`recent:${id}`),
    ])
    if (inbox) store.inbox = inbox.data
    if (today) store.today = today.data
    if (tags) store.tags = tags.data
    if (recent) store.recent = recent
  }
  await Promise.all([loadInbox(), loadToday(), loadTags()])
}

/** Inbox items left to triage (the tab badge). */
export function inboxCount(): number {
  return store.inbox.length
}

/** Remembers a capture from this phone for "Just captured" (replaced by the server copy later). */
export async function rememberRecent(item: ItemDto) {
  store.recent = [item, ...store.recent.filter((x) => x.id !== item.id)].slice(0, 5)
  // Local previews (blob: URLs) don't survive a restart; the server copy brings real ones.
  const stored = store.recent.map((x) => ({
    ...x,
    attachments: x.attachments.filter((a) => !a.url.startsWith('blob:')),
  }))
  await writeJson(`recent:${userId()}`, stored)
}

/** Puts a changed item everywhere it shows. Items leave the inbox once triaged. */
export function upsertItem(item: ItemDto) {
  const i = store.inbox.findIndex((x) => x.id === item.id)
  if (item.status === 'INBOX') {
    if (i === -1) {
      store.inbox.unshift(item)
      store.inbox.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    } else store.inbox.splice(i, 1, item)
  } else if (i !== -1) store.inbox.splice(i, 1)
  const r = store.recent.findIndex((x) => x.id === item.id)
  if (r !== -1) store.recent.splice(r, 1, item)
}

export function dropItem(id: string) {
  store.inbox = store.inbox.filter((x) => x.id !== id)
  store.recent = store.recent.filter((x) => x.id !== id)
}

export function clearStore() {
  store.inbox = []
  store.inboxLoaded = false
  store.today = null
  store.tags = []
  store.recent = []
  store.syncedAt = null
}

export type { ItemStatus }
