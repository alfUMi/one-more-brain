import { EXTENSION_UA_PREFIX } from '@omb/shared'

/**
 * Issues a new bearer session for the browser extension (its own device in Settings › Devices).
 * Called by /auth/extension with the web session cookie; the page hands the token to the extension.
 */
export default defineEventHandler(async (event): Promise<{ token: string }> => {
  const userId = await requireUserId(event)
  // Same-origin only: the token must never be handed to another site.
  const origin = getRequestHeader(event, 'origin')
  if (!origin || new URL(origin).host !== getRequestHost(event, { xForwardedHost: true })) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const ua = getRequestHeader(event, 'user-agent') ?? ''
  const ctx = await auth.$context
  const session = await ctx.internalAdapter.createSession(userId, false, {
    userAgent: `${EXTENSION_UA_PREFIX} ${ua}`.trim(),
  })
  if (!session) throw createError({ statusCode: 500, statusMessage: 'Could not create a session' })
  return { token: session.token }
})
