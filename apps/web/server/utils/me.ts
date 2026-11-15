import type { H3Event } from 'h3'

/** The signed-in user's id, or a 401. Works with the session cookie and with bearer tokens. */
export async function requireUserId(event: H3Event): Promise<string> {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return session.user.id
}

export const meSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  locale: true,
  timezone: true,
  digestTime: true,
  digestEnabled: true,
  theme: true,
  accent: true,
} as const

export type Me = {
  id: string
  email: string
  name: string
  image: string | null
  locale: string
  timezone: string
  digestTime: string
  digestEnabled: boolean
  theme: string
  accent: string
}
