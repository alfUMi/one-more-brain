import { webPushChannelSchema } from '@omb/shared'

/**
 * Registers this browser for Web Push. Idempotent per endpoint; if another account used this browser
 * before, the subscription moves to the signed-in user.
 */
export default defineEventHandler(async (event): Promise<{ id: string }> => {
  const userId = await requireUserId(event)
  const input = await readValidatedBody(event, (body) => webPushChannelSchema.parse(body))
  const data = {
    userId,
    keys: input.keys,
    label: input.label ?? null,
    enabled: true,
    lastSeenAt: new Date(),
  }
  const channel = await db.channel.upsert({
    where: { kind_address: { kind: 'WEB_PUSH', address: input.endpoint } },
    create: { kind: 'WEB_PUSH', address: input.endpoint, ...data },
    update: data,
    select: { id: true },
  })
  return channel
})
