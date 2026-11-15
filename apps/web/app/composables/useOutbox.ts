import {
  Outbox,
  RejectedError,
  type OutboxEntry,
  type OutboxEvent,
  type OutboxFile,
} from '@omb/api-client'
import type { CreateItemInput } from '@omb/shared'
import { outboxStore } from '~/lib/localDb'

type Listener = (event: OutboxEvent) => void

let instance: { userId: string; outbox: Outbox } | null = null
const listeners = new Set<Listener>()
let started = false

/** Statuses that will never succeed on retry. 401 (signed out), 408 and 429 are retried. */
function isRejection(status: number) {
  return status >= 400 && status < 500 && ![401, 408, 429].includes(status)
}

async function guard<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status && isRejection(status)) {
      const message = (error as { statusMessage?: string }).statusMessage ?? `HTTP ${status}`
      throw new RejectedError(message, status)
    }
    throw error
  }
}

/**
 * Every capture goes through the outbox: stored on this device first, then sent. Offline captures
 * (and their images) wait here and sync on their own when the connection is back.
 */
export function useOutbox() {
  const pendingIds = useState<string[]>('outbox-pending', () => [])
  const { user } = useCurrentUser()
  const api = useItemsApi()

  async function refreshPending() {
    const outbox = get()
    pendingIds.value = outbox ? (await outbox.pending()).map((e) => e.id) : []
  }

  function emit(event: OutboxEvent) {
    if (event.type === 'changed') void refreshPending()
    for (const listener of listeners) listener(event)
  }

  function get(): Outbox | null {
    const userId = user.value?.id
    if (!import.meta.client || !userId) return null
    if (instance?.userId !== userId) {
      instance = {
        userId,
        outbox: new Outbox(
          outboxStore(userId),
          {
            upload: (itemId, file) => guard(api.upload(itemId, file.blob, file.attachmentId)),
            create: (input) => guard(api.create(input)),
          },
          emit,
        ),
      }
    }
    return instance.outbox
  }

  /** Stores the capture, then tries to send it right away. */
  async function capture(input: CreateItemInput, files: OutboxFile[] = []) {
    const outbox = get()
    if (!outbox) throw new Error('Not signed in')
    await outbox.add(input, files)
    void outbox.flush(true)
  }

  async function pending(): Promise<OutboxEntry[]> {
    return (await get()?.pending()) ?? []
  }

  /** Subscribes for the lifetime of the calling component. */
  function on(listener: Listener) {
    listeners.add(listener)
    onBeforeUnmount(() => listeners.delete(listener))
  }

  /** Once per app: flush now, when the browser comes back online, and every 30 s. */
  function start() {
    if (started || !import.meta.client) return
    started = true
    const flush = (force: boolean) =>
      void get()
        ?.flush(force)
        .catch(() => undefined)
    flush(true)
    void refreshPending()
    window.addEventListener('online', () => flush(true))
    setInterval(() => pendingIds.value.length && flush(false), 30_000)
  }

  return { pendingIds, capture, pending, on, start }
}
