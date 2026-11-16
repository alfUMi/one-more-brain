import type { PushPayload } from '@omb/shared'
import { fcmConfigured, sendFcm } from './fcm'
import { sendWebPush, type SendResult, type WebPushTarget } from './webpush'

/** The parts of a Channel row a sender needs. */
export interface ChannelTarget {
  kind: 'WEB_PUSH' | 'EXTENSION_PUSH' | 'FCM' | 'TELEGRAM'
  address: string
  keys: unknown
}

/** Whether this server can deliver to the channel at all (FCM needs a service account). */
export function canDeliver(channel: ChannelTarget): boolean {
  if (channel.kind === 'FCM') return fcmConfigured()
  return channel.kind === 'WEB_PUSH' || channel.kind === 'EXTENSION_PUSH'
}

/** Sends a reminder or digest notification over the channel's own transport. */
export function sendToChannel(channel: ChannelTarget, payload: PushPayload): Promise<SendResult> {
  if (channel.kind === 'FCM') return sendFcm(channel.address, payload)
  return sendWebPush(
    { endpoint: channel.address, keys: channel.keys as WebPushTarget['keys'] },
    payload,
  )
}
