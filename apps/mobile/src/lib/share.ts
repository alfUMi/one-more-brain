import { Filesystem } from '@capacitor/filesystem'
import { CapacitorShareTarget, type ShareReceivedEvent } from '@capgo/capacitor-share-target'
import { IMAGE_MIMES, MAX_UPLOAD_BYTES } from '@omb/shared'
import { ref } from 'vue'
import { isNative } from './config'
import { base64ToBlob } from './outbox'

/** What another app shared into One More Brain, ready for the share sheet. */
export interface IncomingShare {
  title: string
  text: string
  url: string | null
  images: Blob[]
}

/** Set when something arrives from the system share sheet; the Share sheet shows it. */
export const incoming = ref<IncomingShare | null>(null)

const URL_RE = /https?:\/\/[^\s<>"']+/i

async function readImage(uri: string, mime: string): Promise<Blob | null> {
  if (!(IMAGE_MIMES as readonly string[]).includes(mime)) return null
  try {
    const { data } = await Filesystem.readFile({ path: uri })
    const blob = typeof data === 'string' ? base64ToBlob(data, mime) : data
    return blob.size <= MAX_UPLOAD_BYTES ? new Blob([blob], { type: mime }) : null
  } catch {
    return null
  }
}

export async function toIncoming(event: ShareReceivedEvent): Promise<IncomingShare> {
  const text = event.texts.join('\n').trim()
  const url = text.match(URL_RE)?.[0] ?? null
  const images = (
    await Promise.all(event.files.slice(0, 10).map((f) => readImage(f.uri, f.mimeType)))
  ).filter((b): b is Blob => b !== null)
  return { title: event.title?.trim() ?? '', text, url, images }
}

export async function initShare() {
  if (!isNative) return
  await CapacitorShareTarget.addListener('shareReceived', (event) => {
    void toIncoming(event).then((share) => (incoming.value = share))
  })
}
