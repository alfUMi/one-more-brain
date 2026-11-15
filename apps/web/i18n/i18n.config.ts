import { messages } from '@omb/shared/i18n'

export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en',
  messages,
}))
