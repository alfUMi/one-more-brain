import { Browser } from '@capacitor/browser'
import { MOBILE_SCHEME } from '@omb/shared'
import { APP_URL } from './config'
import { deviceLabel } from './device'
import { readJson, writeJson } from './prefs'
import { api, startSession } from './session'

/**
 * Sign-in, PKCE style: the app keeps a random verifier, sends its SHA-256 challenge to the web
 * sign-in, and gets a one-time code back through `onemorebrain://auth?code=…`. Only this app,
 * holding the verifier, can trade that code for a token.
 */
const VERIFIER_KEY = 'auth.verifier'

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/** A fresh verifier for this attempt; returns its challenge. */
async function newChallenge(): Promise<string> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  await writeJson(VERIFIER_KEY, verifier)
  return challengeFor(verifier)
}

/** Where the web app lands after signing in: the page that hands the code back to the app. */
function returnPath(challenge: string) {
  return `/auth/mobile?challenge=${challenge}`
}

/** Whether the server offers Google sign-in. */
export async function googleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${APP_URL}/api/v1/auth/providers`)
    return Boolean(((await res.json()) as { google?: boolean }).google)
  } catch {
    return false
  }
}

/** Google: the whole flow runs in the in-app browser, which returns through the deep link. */
export async function signInWithGoogle() {
  const challenge = await newChallenge()
  const next = encodeURIComponent(returnPath(challenge))
  await Browser.open({ url: `${APP_URL}/login?provider=google&next=${next}` })
}

/** Email: the server mails a link; opening it on the phone comes back through the deep link. */
export async function sendMagicLink(email: string) {
  const challenge = await newChallenge()
  const res = await fetch(`${APP_URL}/api/auth/sign-in/magic-link`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, callbackURL: returnPath(challenge) }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

/** Handles `onemorebrain://auth?code=…`. Returns true when this phone is now signed in. */
export async function completeSignIn(url: string): Promise<boolean> {
  const parsed = new URL(url)
  if (parsed.protocol !== `${MOBILE_SCHEME}:` || parsed.host !== 'auth') return false
  const code = parsed.searchParams.get('code')
  const verifier = await readJson<string>(VERIFIER_KEY)
  if (!code || !verifier) throw new Error('Missing sign-in code')
  await Browser.close().catch(() => undefined)
  const { token } = await api.exchangeMobileCode({ code, verifier, label: await deviceLabel() })
  await writeJson(VERIFIER_KEY, null)
  await startSession(token)
  return true
}
