import en from './en'
import ru from './ru'

/** Same shape as T, with every leaf widened to string, so translations must cover every key. */
export type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>
}

export const LOCALES = ['en', 'ru'] as const
export type Locale = (typeof LOCALES)[number]

export const messages = { en, ru } as const
