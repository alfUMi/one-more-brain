import { describe, expect, it } from 'vitest'
import { newId } from '../src/ids'
import { createItemSchema, updateMeSchema } from '../src/schemas'

describe('createItemSchema', () => {
  const base = {
    id: newId(),
    kind: 'TEXT',
    source: 'WEB',
    capturedAt: '2026-11-15T08:00:00Z',
  } as const

  it('accepts a text item and normalizes tags', () => {
    const item = createItemSchema.parse({ ...base, body: 'call mom', tags: ['Family', 'людям'] })
    expect(item.tags).toEqual(['family', 'людям'])
    expect(item.capturedAt).toBeInstanceOf(Date)
  })

  it('rejects an empty text item', () => {
    expect(createItemSchema.safeParse(base).success).toBe(false)
  })

  it('rejects non-v7 ids', () => {
    const r = createItemSchema.safeParse({
      ...base,
      id: '3b241101-e2bb-4255-8caf-4136c566a962',
      body: 'x',
    })
    expect(r.success).toBe(false)
  })

  it('rejects tags with spaces', () => {
    expect(createItemSchema.safeParse({ ...base, body: 'x', tags: ['two words'] }).success).toBe(
      false,
    )
  })
})

describe('updateMeSchema', () => {
  it('validates time zone and digest time', () => {
    expect(
      updateMeSchema.safeParse({ timezone: 'Europe/Berlin', digestTime: '08:30' }).success,
    ).toBe(true)
    expect(updateMeSchema.safeParse({ timezone: 'Mars/Base' }).success).toBe(false)
    expect(updateMeSchema.safeParse({ digestTime: '25:00' }).success).toBe(false)
  })

  it('only allows known accents', () => {
    expect(updateMeSchema.safeParse({ accent: 'teal' }).success).toBe(true)
    expect(updateMeSchema.safeParse({ accent: 'orange' }).success).toBe(false)
  })
})
