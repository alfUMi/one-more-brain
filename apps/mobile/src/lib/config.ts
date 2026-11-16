import { Capacitor } from '@capacitor/core'

/**
 * Origin of the web app (API) this build talks to: VITE_APP_URL at build time. Without it, the dev
 * server on this computer (the Android emulator reaches the host as 10.0.2.2).
 */
export const APP_URL: string = (
  import.meta.env.VITE_APP_URL ||
  (Capacitor.getPlatform() === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000')
).replace(/\/$/, '')

export const APP_HOST = new URL(APP_URL).host

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web'

export const APP_VERSION = '0.1.0'
