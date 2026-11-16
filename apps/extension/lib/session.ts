import { browser } from 'wxt/browser'

/** What the extension keeps about the signed-in user (from /api/v1/me). */
export interface Profile {
  id: string
  email: string
  locale: string
  timezone: string
  theme: string
  accent: string
}

interface SessionState {
  token?: string
  profile?: Profile
}

export async function getSession(): Promise<SessionState> {
  return (await browser.storage.local.get(['token', 'profile'])) as SessionState
}

export async function getToken(): Promise<string | null> {
  return (await getSession()).token ?? null
}

export async function setToken(token: string) {
  await browser.storage.local.set({ token })
}

export async function setProfile(profile: Profile) {
  await browser.storage.local.set({ profile })
}

/** Signed out (or the session was revoked in Settings › Devices). */
export async function clearSession() {
  await browser.storage.local.remove(['token', 'profile'])
}
