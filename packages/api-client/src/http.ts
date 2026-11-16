import type {
  AttachmentInput,
  CreateItemInput,
  FcmChannelInput,
  ItemDto,
  ItemKind,
  ItemPage,
  ListItemsQuery,
  MobileExchangeInput,
  ReminderDto,
  ReminderInput,
  SnoozeInput,
  TagDto,
  TodayDto,
  UiPrefs,
  UpdateItemInput,
  UpdateMeInput,
  UpdateReminderInput,
} from '@omb/shared'
import { RejectedError } from './outbox'

/** The signed-in user, as GET /api/v1/me returns it. */
export interface Profile {
  id: string
  email: string
  name: string
  image: string | null
  locale: string
  timezone: string
  digestTime: string
  digestEnabled: boolean
  theme: string
  accent: string
  prefs: UiPrefs
}

/** A signed-in device (Better Auth session), for Settings › Devices. */
export interface SessionRow {
  id: string
  token: string
  userAgent?: string | null
  createdAt: string
  updatedAt: string
}

/** A device that gets notifications. */
export interface PushDeviceRow {
  id: string
  label: string | null
  enabled: boolean
  lastSeenAt: string | null
  createdAt: string
}

export type KindCounts = Record<ItemKind | 'ALL', number>

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message = `HTTP ${status}`,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/** Statuses that will never succeed on retry. 401 (signed out), 408 and 429 are retried. */
export function isRejection(status: number) {
  return status >= 400 && status < 500 && ![401, 408, 429].includes(status)
}

export interface ApiClientOptions {
  /** Origin of the web app, e.g. https://brain.example.com */
  baseUrl: string
  /** Bearer token for this device, or null when signed out. */
  getToken: () => Promise<string | null> | string | null
  /** Called once a request comes back 401: the session was revoked or expired. */
  onUnauthorized?: () => void
  fetch?: typeof fetch
}

type Query = Record<string, string | number | undefined>

function withQuery(path: string, query?: Query) {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

async function imageSize(blob: Blob): Promise<{ width?: number; height?: number }> {
  try {
    const bmp = await createImageBitmap(blob)
    const size = { width: bmp.width, height: bmp.height }
    bmp.close()
    return size
  } catch {
    return {}
  }
}

/**
 * Typed client for /api/v1 with a bearer token: the mobile app's (and any non-browser client's)
 * way to talk to the server. 4xx answers that retrying cannot fix throw RejectedError, so the
 * outbox drops them; everything else throws HttpError.
 */
export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    { auth = true }: { auth?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (auth) {
      const token = await opts.getToken()
      if (!token) throw new HttpError(401)
      headers.authorization = `Bearer ${token}`
    }
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await doFetch(`${opts.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      if (res.status === 401 && auth) opts.onUnauthorized?.()
      let message = `HTTP ${res.status}`
      try {
        const data = (await res.json()) as { statusMessage?: string; message?: string }
        message = data.statusMessage ?? data.message ?? message
      } catch {
        // not JSON
      }
      if (isRejection(res.status)) throw new RejectedError(message, res.status)
      throw new HttpError(res.status, message)
    }
    if (res.status === 204) return null as T
    const text = await res.text()
    return (text ? JSON.parse(text) : null) as T
  }

  const get = <T>(path: string, query?: Query) => request<T>('GET', withQuery(path, query))
  const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body)
  const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body)
  const del = <T>(path: string, body?: unknown) => request<T>('DELETE', path, body)

  return {
    // Account
    me: () => get<Profile>('/api/v1/me'),
    updateMe: (input: UpdateMeInput) => patch<Profile>('/api/v1/me', input),
    exchangeMobileCode: (input: MobileExchangeInput) =>
      request<{ token: string }>('POST', '/api/v1/auth/mobile-exchange', input, { auth: false }),
    signOut: () => post<unknown>('/api/auth/sign-out', {}),
    sessions: () => get<SessionRow[]>('/api/auth/list-sessions'),
    revokeSession: (token: string) => post<unknown>('/api/auth/revoke-session', { token }),

    // Items
    list: (query: ListItemsQuery) => get<ItemPage>('/api/v1/items', query as Query),
    counts: (status?: string) => get<KindCounts>('/api/v1/items/counts', { status }),
    get: (id: string) => get<ItemDto>(`/api/v1/items/${id}`),
    create: (input: CreateItemInput) => post<ItemDto>('/api/v1/items', input),
    update: (id: string, input: UpdateItemInput) => patch<ItemDto>(`/api/v1/items/${id}`, input),
    remove: (id: string) => del<null>(`/api/v1/items/${id}`),
    remember: (id: string) => post<ItemDto>(`/api/v1/items/${id}/review`),
    answerReview: (itemId: string, gotIt: boolean) =>
      post<{ nextAt: string; step: number; graduated: boolean }>(
        `/api/v1/items/${itemId}/review/answer`,
        { gotIt },
      ),
    tags: () => get<TagDto[]>('/api/v1/tags'),
    today: () => get<TodayDto>('/api/v1/today'),

    // Reminders
    addReminder: (itemId: string, input: ReminderInput) =>
      post<ReminderDto>(`/api/v1/items/${itemId}/reminders`, input),
    updateReminder: (id: string, input: UpdateReminderInput) =>
      patch<ReminderDto>(`/api/v1/reminders/${id}`, input),
    snooze: (id: string, input: SnoozeInput) =>
      post<ReminderDto>(`/api/v1/reminders/${id}/snooze`, input),

    // Notifications
    registerFcm: (input: FcmChannelInput) => post<{ id: string }>('/api/v1/push/fcm', input),
    unregisterFcm: (token: string) => del<null>('/api/v1/push/fcm', { token }),
    pushDevices: () => get<PushDeviceRow[]>('/api/v1/push/subscriptions'),
    removePushDevice: (id: string) => del<null>(`/api/v1/push/subscriptions/${id}`),
    testDigest: () => post<{ channels: number }>('/api/v1/digest/test'),

    /** Presigned upload of one image; returns it ready to attach to the item. */
    async upload(
      itemId: string,
      blob: Blob,
      attachmentId: string,
      kind: AttachmentInput['kind'] = 'IMAGE',
    ): Promise<AttachmentInput> {
      const mime = blob.type as AttachmentInput['mime']
      const { url } = await post<{ url: string }>('/api/v1/uploads', {
        itemId,
        attachmentId,
        mime,
        sizeBytes: blob.size,
      })
      const res = await doFetch(url, {
        method: 'PUT',
        body: blob,
        headers: { 'content-type': mime },
      })
      if (!res.ok) throw new HttpError(res.status, `Upload failed: ${res.status}`)
      return { id: attachmentId, kind, mime, ...(await imageSize(blob)) }
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
