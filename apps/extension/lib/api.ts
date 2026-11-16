import { RejectedError } from '@omb/api-client'
import type {
  AttachmentInput,
  CreateItemInput,
  ItemDto,
  SnoozeInput,
  UpdateItemInput,
  WebPushChannelInput,
} from '@omb/shared'
import { APP_URL } from './config'
import { clearSession, getToken, type Profile } from './session'

export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`)
    this.name = 'HttpError'
  }
}

/** Statuses that will never succeed on retry. 401 (signed out), 408 and 429 are retried. */
function isRejection(status: number) {
  return status >= 400 && status < 500 && ![401, 408, 429].includes(status)
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getToken()
  if (!token) throw new HttpError(401)
  const res = await fetch(`${APP_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (res.status === 401) await clearSession()
  if (!res.ok) {
    if (isRejection(res.status)) throw new RejectedError(`HTTP ${res.status}`, res.status)
    throw new HttpError(res.status)
  }
  return (res.status === 204 ? null : await res.json()) as T
}

async function imageSize(blob: Blob) {
  try {
    const bmp = await createImageBitmap(blob)
    const size = { width: bmp.width, height: bmp.height }
    bmp.close()
    return size
  } catch {
    return {}
  }
}

/** Typed calls to /api/v1 with the extension's bearer token. */
export const api = {
  me: () => request<Profile>('/api/v1/me'),
  create: (input: CreateItemInput) =>
    request<ItemDto>('/api/v1/items', { method: 'POST', body: input }),
  update: (id: string, input: UpdateItemInput) =>
    request<ItemDto>(`/api/v1/items/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/api/v1/items/${id}`, { method: 'DELETE' }),
  snooze: (reminderId: string, input: SnoozeInput) =>
    request(`/api/v1/reminders/${reminderId}/snooze`, { method: 'POST', body: input }),
  pushKey: () => request<{ publicKey: string | null }>('/api/v1/push/key'),
  subscribePush: (input: WebPushChannelInput) =>
    request<{ id: string }>('/api/v1/push/subscriptions', { method: 'POST', body: input }),
  unsubscribePush: (endpoint: string) =>
    request<null>('/api/v1/push/subscriptions', { method: 'DELETE', body: { endpoint } }),

  /** Presigned upload of one image; returns it ready to attach to the item. */
  async upload(
    itemId: string,
    blob: Blob,
    attachmentId: string,
    kind: AttachmentInput['kind'],
  ): Promise<AttachmentInput> {
    const mime = blob.type as AttachmentInput['mime']
    const { url } = await request<{ url: string }>('/api/v1/uploads', {
      method: 'POST',
      body: { itemId, attachmentId, mime, sizeBytes: blob.size },
    })
    const res = await fetch(url, { method: 'PUT', body: blob, headers: { 'content-type': mime } })
    if (!res.ok) throw new HttpError(res.status)
    return { id: attachmentId, kind, mime, ...(await imageSize(blob)) }
  },
}
