import { SecureStorage } from '@aparajita/capacitor-secure-storage'

/** The bearer token lives in the Keychain (iOS) / Keystore-backed storage (Android). */
const TOKEN_KEY = 'omb.token'

export async function readToken(): Promise<string | null> {
  try {
    const value = await SecureStorage.get(TOKEN_KEY)
    return typeof value === 'string' && value ? value : null
  } catch {
    return null
  }
}

export async function writeToken(token: string | null) {
  if (token) await SecureStorage.set(TOKEN_KEY, token)
  else await SecureStorage.remove(TOKEN_KEY).catch(() => false)
}
