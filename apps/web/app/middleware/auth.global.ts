import type { Me } from '~~/server/utils/me'
import { ACCENTS, THEMES, type Accent, type Theme } from '@omb/shared'

declare module '#app' {
  interface PageMeta {
    /** Page is reachable without signing in. */
    public?: boolean
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, refresh } = useCurrentUser()
  if (user.value === undefined) {
    const me = await refresh()
    if (me) {
      const theme = (THEMES as readonly string[]).includes(me.theme)
        ? (me.theme as Theme)
        : 'system'
      const accent = (ACCENTS as readonly string[]).includes(me.accent)
        ? (me.accent as Accent)
        : 'teal'
      useAppearance().apply(theme, accent)
      // New accounts start on UTC; adopt the browser's zone so dates in captures mean local time.
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (me.timezone === 'UTC' && browserTz && browserTz !== 'UTC') {
        user.value = await $fetch<Me>('/api/v1/me', {
          method: 'PATCH',
          body: { timezone: browserTz },
        }).catch(() => me)
      }
      await useNuxtApp().$i18n.setLocale(me.locale === 'ru' ? 'ru' : 'en')
    }
  }

  if (!user.value && !to.meta.public) {
    // Come back here after signing in (only for pages other than the Inbox).
    return navigateTo(to.path === '/' ? '/login' : { path: '/login', query: { next: to.fullPath } })
  }
  if (user.value && to.path === '/login') {
    const next = to.query.next
    return navigateTo(
      typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/',
    )
  }
})
