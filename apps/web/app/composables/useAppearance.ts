import type { Accent, Theme } from '@omb/shared'

/** Nuxt UI color palette closest to each accent (used for its tinted variants). */
const ACCENT_PALETTE: Record<Accent, string> = {
  teal: 'teal',
  violet: 'violet',
  blue: 'blue',
  rose: 'rose',
  graphite: 'neutral',
}

/** Applies the user's theme and accent to the page. Exact accent colors live in main.css. */
export function useAppearance() {
  const colorMode = useColorMode()
  const appConfig = useAppConfig()

  function apply(theme: Theme, accent: Accent) {
    colorMode.preference = theme
    appConfig.ui.colors.primary = ACCENT_PALETTE[accent]
    document.documentElement.dataset.accent = accent
  }

  return { apply }
}
