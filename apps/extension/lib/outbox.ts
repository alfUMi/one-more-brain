import { Outbox, type OutboxEntry, type OutboxEvent, type OutboxStore } from '@omb/api-client'
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { api } from './api'

/**
 * Captures wait here (IndexedDB keeps the image blobs) until the server has them, so nothing is
 * lost offline or while signed out. The service worker retries on an alarm.
 */
interface ExtSchema extends DBSchema {
  outbox: { key: string; value: OutboxEntry }
}

let dbPromise: Promise<IDBPDatabase<ExtSchema>> | undefined
function db() {
  dbPromise ??= openDB<ExtSchema>('omb-extension', 1, {
    upgrade(db) {
      db.createObjectStore('outbox', { keyPath: 'id' })
    },
  })
  return dbPromise
}

export const outboxStore: OutboxStore & {
  get(id: string): Promise<OutboxEntry | undefined>
} = {
  list: async () => (await db()).getAll('outbox'),
  get: async (id) => (await db()).get('outbox', id),
  put: async (entry) => void (await (await db()).put('outbox', entry)),
  remove: async (id) => (await db()).delete('outbox', id),
}

const listeners = new Set<(event: OutboxEvent) => void>()
export function onOutboxEvent(listener: (event: OutboxEvent) => void) {
  listeners.add(listener)
}

export const outbox = new Outbox(
  outboxStore,
  {
    upload: (itemId, file) =>
      api.upload(itemId, file.blob, file.attachmentId, file.kind ?? 'IMAGE'),
    create: (input) => api.create(input),
  },
  (event) => listeners.forEach((listener) => listener(event)),
)
