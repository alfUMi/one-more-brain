import { createApiClient, type Profile } from '@omb/api-client'
import type { UpdateMeInput } from '@omb/shared'
import { reactive } from 'vue'
import { applyAppearance } from './appearance'
import { APP_URL } from './config'
import { setLocale } from './i18n'
import { clearCaches, readJson, writeJson } from './prefs'
import { readToken, writeToken } from './secure'

/** Who is signed in on this phone. `ready` turns true once the stored session has been read. */
export const session = reactive({
  ready: false,
  token: null as string | null,
  profile: null as Profile | null,
})

const listeners = new Set<() => void>()

/** Called after the session ends (sign out or revoked), e.g. to go to the sign-in screen. */
export function onSignedOut(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const api = createApiClient({
  baseUrl: APP_URL,
  getToken: () => session.token,
  onUnauthorized: () => void endSession(),
})

function applyProfile(profile: Profile) {
  applyAppearance(profile.theme, profile.accent)
  setLocale(profile.locale)
}

async function storeProfile(profile: Profile) {
  session.profile = profile
  applyProfile(profile)
  await writeJson('profile', profile)
}

/** Reads the stored token and profile, so the app opens signed in (and offline). */
export async function restoreSession() {
  const [token, profile] = await Promise.all([readToken(), readJson<Profile>('profile')])
  session.token = token
  session.profile = token ? profile : null
  if (session.profile) applyProfile(session.profile)
  session.ready = true
  if (token) void refreshProfile()
}

/** Fresh profile from the server. New accounts start on UTC: adopt the phone's zone. */
export async function refreshProfile() {
  try {
    let me = await api.me()
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (me.timezone === 'UTC' && zone && zone !== 'UTC') {
      me = await api.updateMe({ timezone: zone }).catch(() => me)
    }
    await storeProfile(me)
  } catch {
    // Offline: keep the stored copy.
  }
}

export async function startSession(token: string) {
  session.token = token
  await writeToken(token)
  const me = await api.me()
  await storeProfile(me)
  await refreshProfile()
}

/**
 * Saves profile changes right away on screen, then on the server. Rolls back if the server says no.
 * Returns whether the change was saved.
 */
export async function updateProfile(patch: UpdateMeInput): Promise<boolean> {
  const previous = session.profile
  if (!previous) return false
  const optimistic = {
    ...previous,
    ...(patch as Partial<Profile>),
    prefs: { ...previous.prefs, ...patch.prefs },
  }
  session.profile = optimistic
  applyProfile(optimistic)
  try {
    await storeProfile(await api.updateMe(patch))
    return true
  } catch {
    session.profile = previous
    applyProfile(previous)
    return false
  }
}

/** Forgets the session on this phone (after sign out, or when the server revoked it). */
export async function endSession() {
  if (!session.token && !session.profile) return
  session.token = null
  session.profile = null
  await Promise.all([writeToken(null), writeJson('profile', null), clearCaches()])
  for (const listener of listeners) listener()
}

/** Signs this phone out on the server too (Settings › Sign out). */
export async function signOut() {
  await api.signOut().catch(() => undefined)
  await endSession()
}
