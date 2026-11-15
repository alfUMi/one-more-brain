import { updateMeSchema, type UiPrefs } from '@omb/shared'
import type { Me } from '~~/server/utils/me'

export default defineEventHandler(async (event): Promise<Me> => {
  const userId = await requireUserId(event)
  const { prefs, ...data } = await readValidatedBody(event, (body) => updateMeSchema.parse(body))
  const current = prefs
    ? ((await db.user.findUniqueOrThrow({ where: { id: userId }, select: { prefs: true } }))
        .prefs as UiPrefs)
    : undefined
  const me = await db.user.update({
    where: { id: userId },
    // Prefs merge key by key, so one device changing one toggle never resets another.
    data: { ...data, ...(prefs && { prefs: { ...current, ...prefs } }) },
    select: meSelect,
  })
  return { ...me, prefs: (me.prefs ?? {}) as UiPrefs }
})
