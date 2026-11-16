import { Camera, type MediaResult } from '@capacitor/camera'
import { IMAGE_MIMES, MAX_UPLOAD_BYTES } from '@omb/shared'

const MIME_BY_FORMAT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

async function toBlob(result: MediaResult): Promise<Blob | null> {
  if (!result.webPath) return null
  const raw = await (await fetch(result.webPath)).blob()
  const format = (result.metadata?.format ?? '').toLowerCase()
  const type = (IMAGE_MIMES as readonly string[]).includes(raw.type)
    ? raw.type
    : (MIME_BY_FORMAT[format] ?? 'image/jpeg')
  const blob = raw.type === type ? raw : new Blob([raw], { type })
  return blob.size <= MAX_UPLOAD_BYTES ? blob : null
}

const SIZE = { quality: 85, targetWidth: 2048, targetHeight: 2048, correctOrientation: true }

/** One photo from the camera, as JPEG. Null when cancelled. */
export async function takePhoto(): Promise<Blob | null> {
  try {
    return await toBlob(await Camera.takePhoto(SIZE))
  } catch {
    return null
  }
}

/** Up to `limit` photos from the library. */
export async function choosePhotos(limit: number): Promise<Blob[]> {
  try {
    const { results } = await Camera.chooseFromGallery({
      ...SIZE,
      allowMultipleSelection: limit > 1,
      limit,
    })
    return (await Promise.all(results.map(toBlob))).filter((b): b is Blob => b !== null)
  } catch {
    return []
  }
}
