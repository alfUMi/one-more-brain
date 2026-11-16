import { randomBytes } from 'node:crypto'
import { mobileCodeSchema, newId } from '@omb/shared'

/**
 * Step 1 of the mobile sign-in (called by /auth/mobile with the web session cookie): a one-time code
 * tied to the app's challenge. The page hands the code to the app through its deep link.
 */
export default defineEventHandler(async (event): Promise<{ code: string }> => {
  const userId = await requireUserId(event)
  const origin = getRequestHeader(event, 'origin')
  if (!origin || new URL(origin).host !== getRequestHost(event, { xForwardedHost: true })) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const { challenge } = await readValidatedBody(event, (body) => mobileCodeSchema.parse(body))
  const code = randomBytes(32).toString('base64url')
  await db.verification.create({
    data: {
      id: newId(),
      identifier: `${MOBILE_CODE_PREFIX}${code}`,
      value: JSON.stringify({ userId, challenge }),
      expiresAt: new Date(Date.now() + MOBILE_CODE_TTL_MS),
    },
  })
  return { code }
})
