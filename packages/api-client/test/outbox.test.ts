import type { CreateItemInput, ItemDto } from '@omb/shared'
import { describe, expect, it } from 'vitest'
import {
  Outbox,
  RejectedError,
  retryDelay,
  type OutboxEntry,
  type OutboxEvent,
  type OutboxFile,
  type OutboxStore,
} from '../src/outbox'

class MemoryStore implements OutboxStore {
  entries = new Map<string, OutboxEntry>()
  async list() {
    return [...this.entries.values()].map((e) => structuredClone(e))
  }
  async put(e: OutboxEntry) {
    this.entries.set(e.id, structuredClone(e))
  }
  async remove(id: string) {
    this.entries.delete(id)
  }
}

const input = (id: string): CreateItemInput => ({
  id,
  kind: 'TEXT',
  source: 'WEB',
  body: `note ${id}`,
  capturedAt: '2026-11-15T10:00:00Z',
})
const file = (attachmentId: string): OutboxFile => ({
  attachmentId,
  mime: 'image/png',
  blob: new Blob(['x']),
})

function setup(transport: {
  upload?: (itemId: string, f: OutboxFile) => Promise<never> | Promise<unknown>
  create: (i: CreateItemInput) => Promise<unknown>
}) {
  const store = new MemoryStore()
  const events: OutboxEvent[] = []
  let clock = 1_000
  const outbox = new Outbox(
    store,
    {
      upload: async (itemId, f) => {
        await transport.upload?.(itemId, f)
        return { id: f.attachmentId, kind: 'IMAGE', mime: f.mime }
      },
      create: async (i) => (await transport.create(i)) as ItemDto,
    },
    (e) => events.push(e),
    () => clock,
  )
  return { store, events, outbox, tick: (ms: number) => (clock += ms) }
}

describe('Outbox', () => {
  it('sends entries in capture order and removes them', async () => {
    const sent: string[] = []
    const { outbox, store, events, tick } = setup({
      create: async (i) => (sent.push(i.id), { id: i.id }),
    })
    await outbox.add(input('a'))
    tick(1)
    await outbox.add(input('b'))
    await outbox.flush()
    expect(sent).toEqual(['a', 'b'])
    expect(store.entries.size).toBe(0)
    expect(events.filter((e) => e.type === 'synced')).toHaveLength(2)
  })

  it('stops at a network failure, keeps order, and backs off', async () => {
    let online = false
    const sent: string[] = []
    const { outbox, store, tick } = setup({
      create: async (i) => {
        if (!online) throw new TypeError('Failed to fetch')
        sent.push(i.id)
        return { id: i.id }
      },
    })
    await outbox.add(input('a'))
    tick(1)
    await outbox.add(input('b'))
    await outbox.flush()
    expect(store.entries.get('a')!.attempts).toBe(1)
    expect(store.entries.get('b')!.attempts).toBe(0) // never overtakes 'a'

    online = true
    await outbox.flush() // still backing off
    expect(sent).toEqual([])
    tick(retryDelay(1))
    await outbox.flush()
    expect(sent).toEqual(['a', 'b'])
  })

  it('force ignores the backoff (browser came back online)', async () => {
    let online = false
    const { outbox, store } = setup({
      create: async (i) => {
        if (!online) throw new TypeError('offline')
        return { id: i.id }
      },
    })
    await outbox.add(input('a'))
    await outbox.flush()
    online = true
    await outbox.flush(true)
    expect(store.entries.size).toBe(0)
  })

  it('drops rejected entries and moves on', async () => {
    const { outbox, store, events } = setup({
      create: async (i) => {
        if (i.id === 'bad') throw new RejectedError('Bad request', 400)
        return { id: i.id }
      },
    })
    await outbox.add(input('bad'))
    await outbox.add(input('good'))
    await outbox.flush()
    expect(store.entries.size).toBe(0)
    expect(events.find((e) => e.type === 'rejected')).toMatchObject({ entry: { id: 'bad' } })
  })

  it('uploads each file once across retries and attaches them', async () => {
    const uploads: string[] = []
    let fail = true
    let created: CreateItemInput | undefined
    const { outbox, tick } = setup({
      upload: async (_itemId, f) => uploads.push(f.attachmentId),
      create: async (i) => {
        if (fail) throw new Error('500')
        created = i
        return { id: i.id }
      },
    })
    await outbox.add(input('a'), [file('f1'), file('f2')])
    await outbox.flush()
    fail = false
    tick(retryDelay(1))
    await outbox.flush()
    expect(uploads).toEqual(['f1', 'f2'])
    expect(created!.attachments!.map((a) => a.id)).toEqual(['f1', 'f2'])
  })

  it('caps the backoff', () => {
    expect(retryDelay(1)).toBe(5_000)
    expect(retryDelay(3)).toBe(20_000)
    expect(retryDelay(20)).toBe(300_000)
  })
})
