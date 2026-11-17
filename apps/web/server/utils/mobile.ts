import { createHash } from 'node:crypto'

/**
 * Origins the mobile app's web view runs on: `capacitor://localhost` on iOS, `https://localhost` on
 * Android, and `http://localhost:<port>` while developing with live reload.
 */
export function isAppOrigin(origin: string | undefined | null): origin is string {
  if (!origin) return false
  if (origin === 'capacitor://localhost' || origin === 'https://localhost') return true
  return process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)
}

export const APP_ORIGINS = [
  'capacitor://localhost',
  'https://localhost',
  // The app's Vite dev server, opened in a desktop browser.
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5174']),
]

/** Prefix of the Verification rows that hold one-time mobile sign-in codes. */
export const MOBILE_CODE_PREFIX = 'mobile-code:'

/** How long a mobile sign-in code stays valid. */
export const MOBILE_CODE_TTL_MS = 2 * 60 * 1000

/** The mobile app's schedule key is stored only as its SHA-256. */
export function hashScheduleKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/** Header the app's background refresh sends instead of a session token. */
export const SCHEDULE_KEY_HEADER = 'x-schedule-key'
