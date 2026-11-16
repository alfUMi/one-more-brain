import { messages } from '@omb/shared/i18n'
import { createI18n } from 'vue-i18n'

export type AppLocale = 'en' | 'ru'

/** The phone's language until the profile says otherwise. */
export function deviceLocale(): AppLocale {
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: deviceLocale(),
  fallbackLocale: 'en',
  // The shared messages are deeply readonly; vue-i18n wants its own message type.
  messages: { en: messages.en, ru: messages.ru } as never,
})

export function setLocale(locale: string) {
  const value: AppLocale = locale === 'ru' ? 'ru' : 'en'
  i18n.global.locale.value = value
  document.documentElement.lang = value
}

type Translate = (key: string, vars?: Record<string, unknown>) => string

/** `t()` outside components. */
export const t: Translate = (key, vars) => {
  const global = i18n.global as unknown as { t: Translate }
  return global.t(key, vars ?? {})
}
