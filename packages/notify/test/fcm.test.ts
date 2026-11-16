import { describe, expect, it } from 'vitest'
import { fcmMessage } from '../src/fcm'

describe('fcmMessage', () => {
  it('turns a reminder into a notification with ids the app can act on', () => {
    const message = fcmMessage('device-token', {
      type: 'reminder',
      title: 'Call mom',
      body: 'Reminder',
      tag: 'item-1',
      url: '/?item=1',
      reminderId: 'r1',
      itemId: 'i1',
      actions: [{ action: 'done', title: 'Done' }],
    })
    expect(message).toMatchObject({
      token: 'device-token',
      notification: { title: 'Call mom', body: 'Reminder' },
      data: { type: 'reminder', reminderId: 'r1', itemId: 'i1', category: 'reminder' },
      android: { notification: { channelId: 'reminders', tag: 'item-1' } },
      apns: { payload: { aps: { category: 'reminder' } } },
    })
  })

  it('gives the digest review buttons only when it shows a review card', () => {
    const base = {
      type: 'digest' as const,
      title: 'Good morning',
      body: '3 reminders today',
      tag: 'digest' as const,
      url: '/today',
      actions: [],
    }
    expect(fcmMessage('t', { ...base, reviewItemId: 'i9' }).data).toMatchObject({
      category: 'digest-review',
      reviewItemId: 'i9',
    })
    expect(fcmMessage('t', { ...base, reviewItemId: null }).data).toEqual({
      type: 'digest',
      url: '/today',
      tag: 'digest',
      category: 'digest',
    })
  })
})
