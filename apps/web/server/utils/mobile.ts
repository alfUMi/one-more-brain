/**
 * Origins the mobile app's web view runs on: `capacitor://localhost` on iOS, `https://localhost` on
 * Android, and `http://localhost:<port>` while developing with live reload.
 */
export function isAppOrigin(origin: string | undefined | null): origin is string {
  if (!origin) return false
  if (origin === 'capacitor://localhost' || origin === 'https://localhost') return true
  return process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)
}

export const APP_ORIGINS = ['capacitor://localhost', 'https://localhost']

/** Prefix of the Verification rows that hold one-time mobile sign-in codes. */
export const MOBILE_CODE_PREFIX = 'mobile-code:'

/** How long a mobile sign-in code stays valid. */
export const MOBILE_CODE_TTL_MS = 2 * 60 * 1000
