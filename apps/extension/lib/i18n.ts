import { messages } from '@omb/shared/i18n'

export type ExtStrings = (typeof messages)['en']['extension']

function pick(locale?: string | null) {
  const lang = locale ?? (typeof navigator === 'undefined' ? 'en' : navigator.language)
  return lang.startsWith('ru') ? { code: 'ru', m: messages.ru } : { code: 'en', m: messages.en }
}

/** The extension's strings in the profile's language, or the browser's before sign-in. */
export function strings(locale?: string | null): ExtStrings {
  return pick(locale).m.extension as ExtStrings
}

/** Fills `{name}` placeholders. */
export function fill(text: string, vars: Record<string, string | number> = {}) {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

/** `t('reminder.today')` over the shared messages, for the shared formatter. */
export function translator(locale?: string | null) {
  const { code, m } = pick(locale)
  const t = (key: string, vars?: Record<string, string | number>) => {
    const value = key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], m)
    return typeof value === 'string' ? fill(value, vars) : key
  }
  return { locale: code, t }
}
