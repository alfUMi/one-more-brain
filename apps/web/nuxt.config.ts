export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],

  // App screens need the signed-in user; render them in the browser. Public pages can opt into SSR later.
  ssr: false,

  i18n: {
    locales: [
      { code: 'en', name: 'English' },
      { code: 'ru', name: 'Русский' },
    ],
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: { useCookie: true, cookieKey: 'omb_locale', fallbackLocale: 'en' },
    vueI18n: './i18n.config.ts',
  },

  colorMode: { preference: 'system', fallback: 'light', storageKey: 'omb-color-mode' },

  nitro: {
    preset: process.env.NITRO_PRESET ?? 'bun',
  },

  typescript: { strict: true },
})
