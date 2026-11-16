import { fcmChannelSchema } from '@omb/shared'

/** Registers the mobile app on this device for push (its FCM token). Idempotent per token. */
export default defineEventHandler(async (event): Promise<{ id: string }> => {
  const userId = await requireUserId(event)
  const { token, label } = await readValidatedBody(event, (body) => fcmChannelSchema.parse(body))
  const data = { userId, label: label ?? null, enabled: true, lastSeenAt: new Date() }
  return db.channel.upsert({
    where: { kind_address: { kind: 'FCM', address: token } },
    create: { kind: 'FCM', address: token, ...data },
    update: data,
    select: { id: true },
  })
})
