import { createFormatter, type ItemDto } from '@omb/shared'
import { computed } from 'vue'
import { i18n, t } from './i18n'
import { session } from './session'

/** Dates, reminders and recurrences in the user's language and time zone. */
export const formatter = computed(() => {
  const timeZone =
    session.profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
  const locale = i18n.global.locale.value
  return { timeZone, ...createFormatter({ locale, timeZone, t }) }
})

/** The line a list shows for an item: title, else the first line of its text, quote or link. */
export function itemTitle(item: ItemDto): string {
  const text =
    item.title ??
    (item.kind === 'LINK' ? item.pageTitle : null) ??
    item.body?.split('\n').find((line) => line.trim()) ??
    item.quote ??
    item.pageTitle ??
    item.extractedText?.split('\n')[0] ??
    item.url ??
    ''
  return text.trim()
}

/** Whether the list line is the quote of a highlight (shown in serif italics, in quotes). */
export function titleIsQuote(item: ItemDto): boolean {
  return !!item.quote?.trim() && itemTitle(item) === item.quote.trim()
}

/** The list line, with quotes around a highlight's quote. */
export function displayTitle(item: ItemDto): string {
  return titleIsQuote(item) ? `“${itemTitle(item)}”` : itemTitle(item)
}

/** "learning-science.example" from a URL. */
export function hostOf(url: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}
