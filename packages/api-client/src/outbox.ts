import type { AttachmentInput, CreateItemInput, ItemDto } from '@omb/shared'

/**
 * Offline-first capture queue. Every capture is stored first, then sent; nothing is lost when the
 * network is down. Entries are sent in capture order. Storage is pluggable (IndexedDB on the web,
 * chrome.storage in the extension, SQLite on mobile).
 */

export interface OutboxFile {
  attachmentId: string
  mime: AttachmentInput['mime']
  blob: Blob
  /** IMAGE unless said otherwise (the extension saves SCREENSHOTs). */
  kind?: AttachmentInput['kind']
}

export interface OutboxEntry {
  /** The item id (client-generated), so retries stay idempotent. */
  id: string
  input: CreateItemInput
  files: OutboxFile[]
  /** Attachments already uploaded, with their metadata. */
  uploaded: AttachmentInput[]
  attempts: number
  /** Epoch ms; the entry waits until then after a failed attempt. */
  nextAttemptAt: number
  createdAt: number
  lastError?: string
}

export interface OutboxStore {
  list(): Promise<OutboxEntry[]>
  put(entry: OutboxEntry): Promise<void>
  remove(id: string): Promise<void>
}

export interface OutboxTransport {
  upload(itemId: string, file: OutboxFile): Promise<AttachmentInput>
  create(input: CreateItemInput): Promise<ItemDto>
}

/** Thrown by a transport when the server refused the request for good (validation etc.). */
export class RejectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'RejectedError'
  }
}

export type OutboxEvent =
  | { type: 'synced'; item: ItemDto }
  | { type: 'rejected'; entry: OutboxEntry; error: string }
  | { type: 'changed' }

const BASE_DELAY_MS = 5_000
const MAX_DELAY_MS = 5 * 60_000

export function retryDelay(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1))
}

export class Outbox {
  private flushing: Promise<void> | null = null

  constructor(
    private readonly store: OutboxStore,
    private readonly transport: OutboxTransport,
    private readonly onEvent: (event: OutboxEvent) => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  async add(input: CreateItemInput, files: OutboxFile[] = []): Promise<OutboxEntry> {
    const entry: OutboxEntry = {
      id: input.id,
      input,
      files,
      uploaded: [],
      attempts: 0,
      nextAttemptAt: 0,
      createdAt: this.now(),
    }
    await this.store.put(entry)
    this.onEvent({ type: 'changed' })
    return entry
  }

  async pending(): Promise<OutboxEntry[]> {
    return (await this.store.list()).sort((a, b) => a.createdAt - b.createdAt)
  }

  /**
   * Sends due entries in order. Stops at the first retryable failure so later captures never
   * overtake earlier ones. `force` ignores backoff (e.g. the browser just came back online).
   */
  flush(force = false): Promise<void> {
    this.flushing ??= this.run(force).finally(() => (this.flushing = null))
    return this.flushing
  }

  private async run(force: boolean) {
    for (const entry of await this.pending()) {
      if (!force && entry.nextAttemptAt > this.now()) return
      const ok = await this.send(entry)
      if (!ok) return
    }
  }

  /** True when the entry is done (sent or rejected); false to stop and retry later. */
  private async send(entry: OutboxEntry): Promise<boolean> {
    try {
      for (const file of entry.files) {
        if (entry.uploaded.some((u) => u.id === file.attachmentId)) continue
        entry.uploaded.push(await this.transport.upload(entry.id, file))
        await this.store.put(entry)
      }
      const item = await this.transport.create({ ...entry.input, attachments: entry.uploaded })
      await this.store.remove(entry.id)
      this.onEvent({ type: 'synced', item })
      this.onEvent({ type: 'changed' })
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (error instanceof RejectedError) {
        await this.store.remove(entry.id)
        this.onEvent({ type: 'rejected', entry, error: message })
        this.onEvent({ type: 'changed' })
        return true
      }
      entry.attempts += 1
      entry.nextAttemptAt = this.now() + retryDelay(entry.attempts)
      entry.lastError = message
      await this.store.put(entry)
      this.onEvent({ type: 'changed' })
      return false
    }
  }
}
