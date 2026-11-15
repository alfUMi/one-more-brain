import type { UiPrefs } from '@omb/shared'
import type { Me } from '~~/server/utils/me'

export default defineEventHandler(async (event): Promise<Me> => {
  const userId = await requireUserId(event)
  const me = await db.user.findUniqueOrThrow({ where: { id: userId }, select: meSelect })
  return { ...me, prefs: (me.prefs ?? {}) as UiPrefs }
})
