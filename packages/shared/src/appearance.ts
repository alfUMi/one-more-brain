export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]

export const ACCENTS = ['graphite', 'teal', 'violet', 'blue', 'rose'] as const
export type Accent = (typeof ACCENTS)[number]

export const DEFAULT_THEME: Theme = 'system'
export const DEFAULT_ACCENT: Accent = 'graphite'

/** Accent hex values per theme. See docs/PLAN.md, "Visual design". */
export const ACCENT_COLORS: Record<Accent, { light: string; dark: string }> = {
  teal: { light: '#0F766E', dark: '#4FD1C5' },
  violet: { light: '#6D4AE0', dark: '#B79CFF' },
  blue: { light: '#2F5BEA', dark: '#7C98FF' },
  rose: { light: '#C0365A', dark: '#FF8FAB' },
  graphite: { light: '#111111', dark: '#EDEDEB' },
}

/** Soft accent backgrounds (selected nav item, chips), as in main.css. */
export const ACCENT_SOFT: Record<Accent, { light: string; dark: string }> = {
  teal: { light: '#E0F2EF', dark: '#12302D' },
  violet: { light: '#EEE9FC', dark: '#2A2245' },
  blue: { light: '#E8ECFB', dark: '#1E2747' },
  rose: { light: '#FBE7ED', dark: '#3A1A24' },
  graphite: { light: '#EDEDEA', dark: '#262626' },
}
