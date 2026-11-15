import type { OutboxEntry, OutboxStore } from '@omb/api-client'
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

/** This browser's own copy: the capture outbox and cached lists for offline viewing. */
interface LocalSchema extends DBSchema {
  outbox: { key: string; value: OutboxEntry }
  cache: { key: string; value: { savedAt: number; data: unknown } }
}

let dbPromise: Promise<IDBPDatabase<LocalSchema>> | undefined

/** One database per signed-in user, so a shared browser never mixes accounts. */
function db(userId: string) {
  dbPromise ??= openDB<LocalSchema>(`omb-${userId}`, 1, {
    upgrade(db) {
      db.createObjectStore('outbox', { keyPath: 'id' })
      db.createObjectStore('cache')
    },
  })
  return dbPromise
}

export function outboxStore(userId: string): OutboxStore {
  return {
    list: async () => (await db(userId)).getAll('outbox'),
    put: async (entry) => void (await (await db(userId)).put('outbox', entry)),
    remove: async (id) => (await db(userId)).delete('outbox', id),
  }
}

export async function cacheGet<T>(userId: string, key: string): Promise<T | null> {
  const row = await (await db(userId)).get('cache', key)
  return (row?.data as T) ?? null
}

export async function cachePut(userId: string, key: string, data: unknown) {
  await (await db(userId)).put('cache', { savedAt: Date.now(), data }, key)
}
