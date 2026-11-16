import { createHash } from 'node:crypto'
import { mobileExchangeSchema, MOBILE_UA_PREFIX } from '@omb/shared'

/**
 * Step 2 of the mobile sign-in (called by the app, no session yet): trades the one-time code and the
 * verifier behind its challenge for a bearer token. The code works once; it is deleted either way.
 */
export default defineEventHandler(async (event): Promise<{ token: string }> => {
  const { code, verifier, label } = await readValidatedBody(event, (body) =>
    mobileExchangeSchema.parse(body),
  )
  const identifier = `${MOBILE_CODE_PREFIX}${code}`
  const row = await db.verification.findFirst({ where: { identifier } })
  if (row) await db.verification.deleteMany({ where: { identifier } })
  const denied = createError({ statusCode: 400, statusMessage: 'Sign-in link expired' })
  if (!row || row.expiresAt.getTime() < Date.now()) throw denied

  const { userId, challenge } = JSON.parse(row.value) as { userId: string; challenge: string }
  const expected = createHash('sha256').update(verifier).digest('base64url')
  if (expected !== challenge) throw denied

  const ctx = await auth.$context
  const session = await ctx.internalAdapter.createSession(userId, false, {
    userAgent: `${MOBILE_UA_PREFIX} ${label ?? ''}`.trim(),
  })
  if (!session) throw createError({ statusCode: 500, statusMessage: 'Could not create a session' })
  return { token: session.token }
})
