import { createFormatter, type Formatter } from '@omb/shared'

/** Dates, reminders and recurrences in the user's language and time zone. */
export function useFormat() {
  const { t, locale } = useI18n()
  const { user } = useCurrentUser()
  const timeZone = computed(
    () => user.value?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const formatter = computed(() =>
    createFormatter({
      locale: locale.value,
      timeZone: timeZone.value,
      t: (key, vars) => (vars ? t(key, vars) : t(key)),
    }),
  )
  const call =
    <K extends keyof Formatter>(name: K) =>
    (...args: Parameters<Formatter[K]>): string =>
      (formatter.value[name] as (...a: Parameters<Formatter[K]>) => string)(...args)

  return {
    timeZone,
    relative: call('relative'),
    when: call('when'),
    time: call('time'),
    recurrence: call('recurrence'),
    reminder: call('reminder'),
  }
}
