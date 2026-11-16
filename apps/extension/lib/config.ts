declare const __APP_URL__: string

/** Origin of the web app this build talks to (WXT_APP_URL at build time). */
export const APP_URL: string = __APP_URL__

/** The web page that signs the extension in (it sends a bearer token back). */
export function signInUrl(extensionId: string) {
  return `${APP_URL}/auth/extension?id=${encodeURIComponent(extensionId)}`
}
