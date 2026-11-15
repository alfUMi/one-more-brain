export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]

export const ACCENTS = ['teal', 'violet', 'blue', 'rose', 'graphite'] as const
export type Accent = (typeof ACCENTS)[number]

export const DEFAULT_THEME: Theme = 'system'
export const DEFAULT_ACCENT: Accent = 'teal'

/** Accent hex values per theme. See docs/PLAN.md, "Visual design". */
export const ACCENT_COLORS: Record<Accent, { light: string; dark: string }> = {
  teal: { light: '#0F766E', dark: '#4FD1C5' },
  violet: { light: '#6D4AE0', dark: '#B79CFF' },
  blue: { light: '#2F5BEA', dark: '#7C98FF' },
  rose: { light: '#C0365A', dark: '#FF8FAB' },
  graphite: { light: '#15171C', dark: '#E8EAEE' },
}
