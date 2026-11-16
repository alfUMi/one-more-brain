/** Session user agents of extension tokens start with this, so Settings › Devices can name them. */
export const EXTENSION_UA_PREFIX = 'OneMoreBrain-Extension'

/** Messages a web page may send to the extension (allowed by its `externally_connectable`). */
export type ExtensionExternalMessage = { type: 'omb:token'; token: string } | { type: 'omb:ping' }

/** Session user agents of mobile app tokens start with this (followed by the device label). */
export const MOBILE_UA_PREFIX = 'OneMoreBrain-Mobile'

/** The app's deep link scheme: sign-in comes back as `onemorebrain://auth?code=…`. */
export const MOBILE_SCHEME = 'onemorebrain'
