import { appChannelSchema } from '@omb/shared'
import { hashScheduleKey } from '../../../utils/mobile'

/** The app turned notifications off on this phone (or signed out); its schedule key stops working. */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { key } = await readValidatedBody(event, (body) =>
    appChannelSchema.pick({ key: true }).parse(body),
  )
  await db.channel.deleteMany({ where: { userId, kind: 'APP', address: hashScheduleKey(key) } })
  setResponseStatus(event, 204)
  return null
})
