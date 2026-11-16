import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getMessaging, type Message } from 'firebase-admin/messaging'
import type { PushPayload } from '@omb/shared'
import type { SendResult } from './webpush'

let app: App | null | undefined

/**
 * Firebase app from FIREBASE_SERVICE_ACCOUNT (the service account JSON, as one line or base64).
 * Null when it isn't set: the mobile app then simply gets no push.
 */
function firebase(): App | null {
  if (app !== undefined) return app
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) return (app = null)
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(json)) })
  return app
}

export function fcmConfigured(): boolean {
  return firebase() !== null
}

/** Android notification channel ids, created by the app on start. */
export const FCM_ANDROID_CHANNEL = { reminder: 'reminders', digest: 'digest' } as const

/**
 * The same payload as Web Push, as an FCM message: a visible notification plus string data the app
 * reads when the notification is tapped (`url`) or one of its buttons is used (`category`).
 */
export function fcmMessage(token: string, payload: PushPayload): Message {
  const data: Record<string, string> = { type: payload.type, url: payload.url, tag: payload.tag }
  if (payload.type === 'reminder') {
    data.reminderId = payload.reminderId
    data.itemId = payload.itemId
  } else if (payload.reviewItemId) {
    data.reviewItemId = payload.reviewItemId
  }
  // Notification categories registered by the app carry the Done / Snooze / Got it / Forgot buttons.
  const category =
    payload.type === 'reminder' ? 'reminder' : payload.reviewItemId ? 'digest-review' : 'digest'
  data.category = category
  return {
    token,
    notification: { title: payload.title, body: payload.body },
    data,
    android: {
      priority: 'high',
      ttl: 24 * 60 * 60 * 1000,
      collapseKey: payload.tag,
      notification: {
        channelId: FCM_ANDROID_CHANNEL[payload.type],
        tag: payload.tag,
        clickAction: category,
      },
    },
    apns: {
      headers: { 'apns-collapse-id': payload.tag.slice(0, 64) },
      payload: { aps: { category, sound: 'default', threadId: payload.tag } },
    },
  }
}

const GONE = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
])

/** Sends one notification to a device. A token FCM no longer knows comes back EXPIRED. */
export async function sendFcm(token: string, payload: PushPayload): Promise<SendResult> {
  const firebaseApp = firebase()
  if (!firebaseApp) return { status: 'FAILED', error: 'FIREBASE_SERVICE_ACCOUNT is not set' }
  try {
    await getMessaging(firebaseApp).send(fcmMessage(token, payload))
    return { status: 'SENT' }
  } catch (error) {
    const code = (error as { code?: string }).code ?? ''
    const message = `${code} ${error instanceof Error ? error.message : String(error)}`
    if (GONE.has(code)) return { status: 'EXPIRED', error: message.slice(0, 500) }
    return { status: 'FAILED', error: message.slice(0, 500) }
  }
}
