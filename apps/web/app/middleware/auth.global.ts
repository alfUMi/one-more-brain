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
      await useNuxtApp().$i18n.setLocale(me.locale === 'ru' ? 'ru' : 'en')
    }
  }

  if (!user.value && !to.meta.public) return navigateTo('/login')
  if (user.value && to.path === '/login') return navigateTo('/')
})
