import type { Me } from '~~/server/utils/me'

/**
 * The signed-in user, or null. `undefined` means "not loaded yet".
 * Loaded once by the auth middleware, then shared through useState.
 */
export function useCurrentUser() {
  const user = useState<Me | null | undefined>('me', () => undefined)

  async function refresh() {
    try {
      user.value = await $fetch<Me>('/api/v1/me')
    } catch {
      user.value = null
    }
    return user.value
  }

  async function signOut() {
    const { authClient } = await import('~/lib/auth-client')
    await authClient.signOut()
    user.value = null
    await navigateTo('/login')
  }

  return { user, refresh, signOut }
}
