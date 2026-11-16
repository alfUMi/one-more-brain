import { Preferences } from '@capacitor/preferences'

/** Small JSON values kept on the phone (cached lists, the signed-in profile, UI choices). */
export async function readJson<T>(key: string): Promise<T | null> {
  const { value } = await Preferences.get({ key })
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function writeJson(key: string, value: unknown) {
  if (value === null || value === undefined) await Preferences.remove({ key })
  else await Preferences.set({ key, value: JSON.stringify(value) })
}

/** Cached server data for offline viewing, one set per signed-in user. */
export interface Cached<T> {
  savedAt: number
  data: T
}

export async function cacheGet<T>(userId: string, key: string): Promise<Cached<T> | null> {
  return readJson<Cached<T>>(`cache:${userId}:${key}`)
}

export async function cachePut(userId: string, key: string, data: unknown) {
  await writeJson(`cache:${userId}:${key}`, { savedAt: Date.now(), data })
}

/** Forgets every cached list (sign out). */
export async function clearCaches() {
  const { keys } = await Preferences.keys()
  await Promise.all(
    keys.filter((k) => k.startsWith('cache:')).map((key) => Preferences.remove({ key })),
  )
}
