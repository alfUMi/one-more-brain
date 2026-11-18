import { StatusBar, Style } from '@capacitor/status-bar'
import {
  ACCENT_COLORS,
  ACCENTS,
  DEFAULT_ACCENT,
  THEMES,
  type Accent,
  type Theme,
} from '@omb/shared'
import { ref } from 'vue'
import { isNative } from './config'

const media = window.matchMedia('(prefers-color-scheme: dark)')
const current = { theme: 'system' as Theme, accent: DEFAULT_ACCENT as Accent }

/** Whether the dark palette is showing right now. */
export const isDark = ref(media.matches)

export function asTheme(value: string | null | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : 'system'
}

export function asAccent(value: string | null | undefined): Accent {
  return (ACCENTS as readonly string[]).includes(value ?? '') ? (value as Accent) : DEFAULT_ACCENT
}

function render() {
  const dark = current.theme === 'dark' || (current.theme === 'system' && media.matches)
  isDark.value = dark
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.classList.toggle('ion-palette-dark', dark)
  root.dataset.accent = current.accent
  root.style.colorScheme = dark ? 'dark' : 'light'
  if (isNative) {
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined)
  }
}

/** Applies the user's theme (light / dark / system) and accent to the whole app. */
export function applyAppearance(
  theme: string | null | undefined,
  accent: string | null | undefined,
) {
  current.theme = asTheme(theme)
  current.accent = asAccent(accent)
  render()
}

media.addEventListener('change', render)

/** The accent's hex for the current palette (for canvas-free places like swatches). */
export function accentHex(accent: Accent, dark = isDark.value) {
  return ACCENT_COLORS[accent][dark ? 'dark' : 'light']
}
