import type { CreateItemInput } from '@omb/shared'

/** Messages from the popup and the in-page toast to the background service worker. */
export type ExtensionMessage =
  | {
      type: 'omb:capture'
      input: CreateItemInput
      /** Screenshot of the visible tab as a data URL (Blobs can't cross extension messaging). */
      screenshot?: string
      /** Where to show the "Saved" toast. */
      tabId?: number
    }
  | { type: 'omb:undo'; id: string }
  | { type: 'omb:note'; id: string; text: string }
  | { type: 'omb:sign-out' }
  | { type: 'omb:pending' }
