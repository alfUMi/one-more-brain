import type { Accent, Theme } from '@omb/shared'

/** Nuxt UI color palette used for each accent option. */
const ACCENT_PALETTE: Record<Accent, string> = {
  teal: 'teal',
  violet: 'violet',
  blue: 'blue',
  rose: 'rose',
  graphite: 'neutral',
}

/** Applies the user's theme and accent to the page. */
export function useAppearance() {
  const colorMode = useColorMode()
  const appConfig = useAppConfig()

  function apply(theme: Theme, accent: Accent) {
    colorMode.preference = theme
    appConfig.ui.colors.primary = ACCENT_PALETTE[accent]
  }

  return { apply }
}
