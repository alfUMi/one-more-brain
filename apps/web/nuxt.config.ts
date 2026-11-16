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
    // English until signed in; after that the profile's locale wins (see auth.global.ts).
    detectBrowserLanguage: false,
    vueI18n: './i18n.config.ts',
  },

  runtimeConfig: {
    public: {
      /**
       * Comma-separated extension ids allowed to receive a sign-in token from /auth/extension
       * (NUXT_PUBLIC_EXTENSION_IDS). The default is the unpacked dev build's fixed id.
       */
      extensionIds: process.env.NODE_ENV === 'production' ? '' : 'ealahabaammegndodbgendfkinpnflae',
    },
  },

  colorMode: { preference: 'system', fallback: 'light', storageKey: 'omb-color-mode' },

  nitro: {
    preset: process.env.NITRO_PRESET ?? 'bun',
  },

  typescript: { strict: true },
})
