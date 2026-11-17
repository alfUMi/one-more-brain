import type { PushPayload } from '@omb/shared'
import { sendWebPush, type SendResult, type WebPushTarget } from './webpush'

/** The parts of a Channel row a sender needs. */
export interface ChannelTarget {
  kind: 'WEB_PUSH' | 'EXTENSION_PUSH' | 'APP' | 'TELEGRAM'
  address: string
  keys: unknown
}

/**
 * Whether the server delivers to the channel. The mobile app (APP) schedules its notifications on
 * the phone from GET /api/v1/notifications/schedule, so the server never sends to it.
 */
export function canDeliver(channel: ChannelTarget): boolean {
  return channel.kind === 'WEB_PUSH' || channel.kind === 'EXTENSION_PUSH'
}

/** Sends a reminder or digest notification over Web Push. */
export function sendToChannel(channel: ChannelTarget, payload: PushPayload): Promise<SendResult> {
  return sendWebPush(
    { endpoint: channel.address, keys: channel.keys as WebPushTarget['keys'] },
    payload,
  )
}
