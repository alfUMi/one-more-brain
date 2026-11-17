import { appChannelSchema } from '@omb/shared'
import { hashScheduleKey } from '../../../utils/mobile'

/** The mobile app turned notifications on for this phone. Idempotent per key. */
export default defineEventHandler(async (event): Promise<{ id: string }> => {
  const userId = await requireUserId(event)
  const { key, label } = await readValidatedBody(event, (body) => appChannelSchema.parse(body))
  const address = hashScheduleKey(key)
  const data = { userId, label: label ?? null, enabled: true, lastSeenAt: new Date() }
  return db.channel.upsert({
    where: { kind_address: { kind: 'APP', address } },
    create: { kind: 'APP', address, ...data },
    update: data,
    select: { id: true },
  })
})
