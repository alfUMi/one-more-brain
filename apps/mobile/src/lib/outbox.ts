import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Outbox, type OutboxEntry, type OutboxEvent, type OutboxStore } from '@omb/api-client'
import type { CreateItemInput, ItemDto } from '@omb/shared'
import { ref } from 'vue'
import { api, session } from './session'

/**
 * Every capture is written to the phone first (app data folder, one JSON file per capture, images
 * inline as base64), then sent. Captures made offline wait here and go out when the network is back.
 */

interface StoredFile {
  attachmentId: string
  mime: OutboxEntry['files'][number]['mime']
  kind?: OutboxEntry['files'][number]['kind']
  base64: string
}
type StoredEntry = Omit<OutboxEntry, 'files'> & { files: StoredFile[] }

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function fileStore(userId: string): OutboxStore {
  const dir = `outbox/${userId}`
  const path = (id: string) => `${dir}/${id}.json`
  return {
    async list() {
      let names: string[]
      try {
        const res = await Filesystem.readdir({ path: dir, directory: Directory.Data })
        names = res.files.map((f) => f.name).filter((n) => n.endsWith('.json'))
      } catch {
        return []
      }
      const entries = await Promise.all(
        names.map(async (name) => {
          try {
            const { data } = await Filesystem.readFile({
              path: `${dir}/${name}`,
              directory: Directory.Data,
              encoding: Encoding.UTF8,
            })
            const stored = JSON.parse(String(data)) as StoredEntry
            return {
              ...stored,
              files: stored.files.map((f) => ({
                attachmentId: f.attachmentId,
                mime: f.mime,
                kind: f.kind,
                blob: base64ToBlob(f.base64, f.mime),
              })),
            } satisfies OutboxEntry
          } catch {
            return null
          }
        }),
      )
      return entries.filter((e) => e !== null)
    },
    async put(entry) {
      const stored: StoredEntry = {
        ...entry,
        files: await Promise.all(
          entry.files.map(async (f) => ({
            attachmentId: f.attachmentId,
            mime: f.mime,
            kind: f.kind,
            base64: await blobToBase64(f.blob),
          })),
        ),
      }
      await Filesystem.writeFile({
        path: path(entry.id),
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        data: JSON.stringify(stored),
        recursive: true,
      })
    },
    async remove(id) {
      await Filesystem.deleteFile({ path: path(id), directory: Directory.Data }).catch(
        () => undefined,
      )
    },
  }
}

let instance: { userId: string; outbox: Outbox } | null = null
const listeners = new Set<(event: OutboxEvent) => void>()

/** Captures still on the phone, oldest first (for "Just captured" and the sync dot). */
export const pending = ref<OutboxEntry[]>([])

async function refreshPending() {
  pending.value = (await instance?.outbox.pending()) ?? []
}

function emit(event: OutboxEvent) {
  if (event.type === 'changed') void refreshPending()
  for (const listener of listeners) listener(event)
}

function outbox(): Outbox | null {
  const userId = session.profile?.id
  if (!userId) return null
  if (instance?.userId !== userId) {
    instance = {
      userId,
      outbox: new Outbox(
        fileStore(userId),
        {
          upload: (itemId, file) => api.upload(itemId, file.blob, file.attachmentId, file.kind),
          create: (input) => api.create(input),
        },
        emit,
      ),
    }
    void refreshPending()
  }
  return instance.outbox
}

export function onOutbox(listener: (event: OutboxEvent) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Stores the capture on the phone, then tries to send it right away. */
export async function capture(
  input: CreateItemInput,
  files: { attachmentId: string; blob: Blob }[] = [],
): Promise<void> {
  const box = outbox()
  if (!box) throw new Error('Not signed in')
  await box.add(
    input,
    files.map((f) => ({
      attachmentId: f.attachmentId,
      mime: f.blob.type as OutboxEntry['files'][number]['mime'],
      blob: f.blob,
    })),
  )
  void box.flush(true).catch(() => undefined)
}

/** Sends what's waiting. `force` skips the backoff (the network just came back). */
export function flushOutbox(force = false) {
  return outbox()
    ?.flush(force)
    .catch(() => undefined)
}

export type { ItemDto }
