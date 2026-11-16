import { fromLocal } from '@omb/shared'
import { messages } from '@omb/shared/i18n'
import { describe, expect, it } from 'vitest'
import { composeDigest, digestDue, type DigestContent } from '../src/digest'

const tz = 'Europe/Berlin'
const at = (d: number, h: number, mi = 0) =>
  fromLocal({ year: 2026, month: 11, day: d, hour: h, minute: mi }, tz)
const user = { timezone: tz, digestTime: '08:00', lastDigestOn: null as Date | null }

describe('digestDue', () => {
  it('waits until the digest time', () => {
    expect(digestDue(at(16, 7, 59), user)).toBe('wait')
  })

  it('sends at and shortly after the digest time', () => {
    expect(digestDue(at(16, 8), user)).toBe('send')
    expect(digestDue(at(16, 10, 30), user)).toBe('send')
  })

  it('skips a digest that would arrive hours late', () => {
    expect(digestDue(at(16, 11, 1), user)).toBe('skip')
  })

  it('sends once a day', () => {
    const sentToday = { ...user, lastDigestOn: new Date(Date.UTC(2026, 10, 16)) }
    expect(digestDue(at(16, 8, 5), sentToday)).toBe('wait')
    expect(digestDue(at(17, 8), sentToday)).toBe('send')
  })

  it('uses the local date, not the UTC one', () => {
    // 00:30 in Tokyo on the 17th is still the 16th in UTC.
    const tokyo = {
      timezone: 'Asia/Tokyo',
      digestTime: '00:15',
      lastDigestOn: new Date(Date.UTC(2026, 10, 16)),
    }
    const now = fromLocal({ year: 2026, month: 11, day: 17, hour: 0, minute: 30 }, 'Asia/Tokyo')
    expect(digestDue(now, tokyo)).toBe('send')
  })
})

const t = messages.en.digest
const empty: DigestContent = {
  reminders: [],
  inbox: { count: 0, oldestCapturedAt: null },
  reviewsDue: 0,
  review: null,
  pastNote: null,
  onThisDay: null,
}

describe('composeDigest', () => {
  const now = at(16, 8)

  it('has nothing to say on an empty day', () => {
    expect(composeDigest(empty, t, now)).toBeNull()
  })

  it('still sends a test digest on an empty day', () => {
    expect(composeDigest(empty, t, now, true)).toEqual({ title: t.testTitle, body: t.nothing })
  })

  it('lists the day in order', () => {
    const digest = composeDigest(
      {
        reminders: [
          { time: '14:30', text: 'Dentist' },
          { time: '18:00', text: 'Send the invoice' },
        ],
        inbox: { count: 7, oldestCapturedAt: at(14, 8) },
        reviewsDue: 3,
        review: { itemId: 'i', text: 'You fall to the level of your systems.' },
        pastNote: null,
        onThisDay: { ago: 'year', text: 'Start small' },
      },
      t,
      now,
    )
    expect(digest?.title).toBe(t.title)
    expect(digest?.body.split('\n')).toEqual([
      'Today: 14:30 Dentist · 18:00 Send the invoice',
      'Inbox: 7 waiting, oldest 2 d',
      'To review: 3',
      'Remember this? “You fall to the level of your systems.”',
      '1 year ago: Start small',
    ])
  })

  it('shows at most three reminders', () => {
    const reminders = ['09:00', '10:00', '11:00', '12:00', '13:00'].map((time) => ({
      time,
      text: 'x',
    }))
    const digest = composeDigest({ ...empty, reminders }, t, now)
    expect(digest?.body).toBe('Today: 09:00 x · 10:00 x · 11:00 x · +2 more')
  })

  it('falls back to a kept note when no review is due', () => {
    const digest = composeDigest({ ...empty, pastNote: 'Fish restaurant in Lisbon' }, t, now)
    expect(digest?.body).toBe('From your notes: “Fish restaurant in Lisbon”')
  })
})
