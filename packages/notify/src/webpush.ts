import { sendNotification, setVapidDetails, WebPushError } from 'web-push'

export interface WebPushTarget {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export type SendResult = { status: 'SENT' } | { status: 'EXPIRED' | 'FAILED'; error: string }

let configured = false

function configure() {
  if (configured) return
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('VAPID keys are not set')
  setVapidDetails(VAPID_SUBJECT ?? 'mailto:admin@localhost', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  configured = true
}

/**
 * Sends one push message. 404/410 from the push service mean the subscription is gone
 * (EXPIRED: disable the channel); anything else is a FAILED attempt worth retrying.
 */
export async function sendWebPush(target: WebPushTarget, payload: unknown): Promise<SendResult> {
  configure()
  try {
    await sendNotification(target, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: 'high' })
    return { status: 'SENT' }
  } catch (error) {
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      return { status: 'EXPIRED', error: `${error.statusCode}` }
    }
    const message =
      error instanceof WebPushError
        ? `${error.statusCode} ${error.body}`.slice(0, 500)
        : String(error).slice(0, 500)
    return { status: 'FAILED', error: message }
  }
}
