import {
  DEFAULT_ACCENT,
  type Accent,
  type Theme,
  type UiPrefs,
  type UpdateMeInput,
} from '@omb/shared'
import type { Me } from '~~/server/utils/me'

/** The signed-in user's settings: read, save (optimistically) and apply at once. */
export function useProfile() {
  const { user } = useCurrentUser()
  const { t, setLocale } = useI18n()
  const appearance = useAppearance()
  const toast = useToast()

  const prefs = computed<Required<UiPrefs>>(() => ({
    keyboardHints: user.value?.prefs?.keyboardHints ?? true,
    compactCards: user.value?.prefs?.compactCards ?? false,
  }))

  async function save(patch: UpdateMeInput) {
    const previous = user.value
    if (!previous) return
    user.value = {
      ...previous,
      ...(patch as Partial<Me>),
      prefs: { ...previous.prefs, ...patch.prefs },
    }
    try {
      user.value = await $fetch<Me>('/api/v1/me', { method: 'PATCH', body: patch })
    } catch {
      user.value = previous
      toast.add({ title: t('toasts.saveFailed'), color: 'error' })
    }
    appearance.apply(
      (user.value?.theme ?? 'system') as Theme,
      (user.value?.accent ?? DEFAULT_ACCENT) as Accent,
    )
    if (patch.locale) await setLocale(patch.locale)
  }

  return { user, prefs, save }
}
