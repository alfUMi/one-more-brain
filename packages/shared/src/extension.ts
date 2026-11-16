/** Session user agents of extension tokens start with this, so Settings › Devices can name them. */
export const EXTENSION_UA_PREFIX = 'OneMoreBrain-Extension'

/** Messages a web page may send to the extension (allowed by its `externally_connectable`). */
export type ExtensionExternalMessage = { type: 'omb:token'; token: string } | { type: 'omb:ping' }
