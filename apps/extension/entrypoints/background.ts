import type { OutboxFile } from '@omb/api-client'
import {
  IMAGE_MIMES,
  MAX_UPLOAD_BYTES,
  newId,
  type AttachmentInput,
  type CreateItemInput,
  type ExtensionExternalMessage,
  type PushPayload,
} from '@omb/shared'
import { browser, type Browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { api } from '../lib/api'
import { APP_URL, signInUrl } from '../lib/config'
import { strings, type ExtStrings } from '../lib/i18n'
import type { ExtensionMessage } from '../lib/messages'
import { outbox, outboxStore, onOutboxEvent } from '../lib/outbox'
import { clearSession, getSession, getToken, setProfile, setToken } from '../lib/session'
import { showToast } from '../lib/toast'

type MenuId = 'highlight' | 'page' | 'link' | 'image' | 'screenshot'
type SavedKind = keyof ExtStrings['saved']

/** Minimal service-worker typings (the extension's tsconfig uses the DOM lib). */
interface PushEventLike extends Event {
  data: { json(): unknown } | null
  waitUntil(promise: Promise<unknown>): void
}
interface NotificationEventLike extends Event {
  action: string
  notification: Notification & { data: PushPayload }
  waitUntil(promise: Promise<unknown>): void
}
const sw = globalThis as unknown as {
  registration: ServiceWorkerRegistration
  addEventListener(type: 'push', listener: (event: PushEventLike) => void): void
  addEventListener(
    type: 'notificationclick',
    listener: (event: NotificationEventLike) => void,
  ): void
}

const isWeb = (url?: string) => Boolean(url && /^https?:\/\//i.test(url))
const clip = (text: string | undefined, max: number) => text?.slice(0, max) || undefined

async function t(): Promise<ExtStrings> {
  return strings((await getSession()).profile?.locale)
}

/** Menu titles follow the profile's language once signed in. */
async function createMenus() {
  const s = await t()
  await browser.contextMenus.removeAll()
  const menus: { id: MenuId; contexts: Browser.contextMenus.CreateProperties['contexts'] }[] = [
    { id: 'highlight', contexts: ['selection'] },
    { id: 'page', contexts: ['page', 'selection'] },
    { id: 'link', contexts: ['link'] },
    { id: 'image', contexts: ['image'] },
    { id: 'screenshot', contexts: ['page', 'selection', 'link', 'image'] },
  ]
  for (const { id, contexts } of menus) {
    browser.contextMenus.create({ id, title: s.menu[id], contexts })
  }
}

async function refreshProfile() {
  if (!(await getToken())) return
  const me = await api.me().catch(() => null)
  if (me) await setProfile(me)
}

/** Registers this extension for reminder pushes (its own channel, listed in Settings › Devices). */
async function ensurePush() {
  try {
    const { publicKey } = await api.pushKey()
    if (!publicKey) return
    const sub =
      (await sw.registration.pushManager.getSubscription()) ??
      (await sw.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      }))
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    await api.subscribePush({
      endpoint: json.endpoint,
      keys: json.keys,
      label: 'Extension',
      kind: 'EXTENSION_PUSH',
    })
  } catch {
    // Push is optional; captures work without it.
  }
}

async function signOut() {
  const sub = await sw.registration.pushManager.getSubscription().catch(() => null)
  if (sub) {
    await api.unsubscribePush(sub.endpoint).catch(() => undefined)
    await sub.unsubscribe().catch(() => undefined)
  }
  const token = await getToken()
  if (token) {
    await fetch(`${APP_URL}/api/auth/sign-out`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{}',
    }).catch(() => undefined)
  }
  await clearSession()
  await createMenus()
}

// ───────────────────────── Feedback in the page ─────────────────────────

/** The toast from the mockup; a system notification where pages can't be scripted (chrome://…). */
async function feedback(tabId: number | undefined, itemId: string, message: string, plain = false) {
  const s = await t()
  if (tabId !== undefined) {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        func: showToast,
        args: [
          {
            itemId,
            message,
            plain,
            addNote: s.addNote,
            notePlaceholder: s.notePlaceholder,
            noteSaved: s.noteSaved,
            undo: s.undo,
            undone: s.undone,
          },
        ],
      })
      return
    } catch {
      // Not scriptable; fall through.
    }
  }
  await browser.notifications.create(`saved-${itemId}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: 'One More Brain',
    message,
  })
}

// ───────────────────────── Capturing ─────────────────────────

/** Undo and notes can arrive while the item is still in the outbox or on its way to the server. */
const undone = new Set<string>()
const lateNotes = new Map<string, string>()

onOutboxEvent((event) => {
  if (event.type !== 'synced') return
  const id = event.item.id
  if (undone.has(id)) {
    undone.delete(id)
    void api.remove(id).catch(() => undefined)
  } else if (lateNotes.has(id)) {
    const body = lateNotes.get(id)!
    lateNotes.delete(id)
    void api.update(id, { body }).catch(() => undefined)
  }
})

async function capture(input: CreateItemInput, files: OutboxFile[] = []) {
  input.attachments = files.map((f) => ({
    id: f.attachmentId,
    kind: f.kind ?? 'IMAGE',
    mime: f.mime,
  })) satisfies AttachmentInput[]
  await outbox.add(input, files)
  void outbox.flush(true).catch(() => undefined)
}

async function undo(id: string) {
  if (await outboxStore.get(id)) {
    await outboxStore.remove(id)
    undone.add(id) // in case it was being sent right now
  } else {
    await api.remove(id).catch(() => undone.add(id))
  }
}

async function addNote(id: string, text: string) {
  const entry = await outboxStore.get(id)
  if (entry) {
    entry.input.body = entry.input.body ? `${entry.input.body}\n\n${text}` : text
    await outboxStore.put(entry)
    lateNotes.set(id, entry.input.body)
  } else {
    const body = await api
      .update(id, { body: text })
      .then((item) => item.body)
      .catch(() => text)
    if (!body) lateNotes.set(id, text)
  }
}

async function dataUrlFile(dataUrl: string, kind: AttachmentInput['kind']): Promise<OutboxFile> {
  const blob = await (await fetch(dataUrl)).blob()
  return { attachmentId: newId(), mime: blob.type as AttachmentInput['mime'], blob, kind }
}

/** Downloads an image for saving, or null when the site does not allow it. */
async function fetchImage(src: string): Promise<OutboxFile | null> {
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    if (!(IMAGE_MIMES as readonly string[]).includes(blob.type) || blob.size > MAX_UPLOAD_BYTES) {
      return null
    }
    return {
      attachmentId: newId(),
      mime: blob.type as AttachmentInput['mime'],
      blob,
      kind: 'IMAGE',
    }
  } catch {
    return null
  }
}

/** The selection with its line breaks (the menu's selectionText flattens them). */
async function selectedText(tabId: number, fallback?: string) {
  try {
    const [result] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection()?.toString() ?? '',
    })
    const text = (result?.result as string | undefined)?.trim()
    return text || fallback
  } catch {
    return fallback
  }
}

async function onMenu(info: Browser.contextMenus.OnClickData, tab?: Browser.tabs.Tab) {
  const s = await t()
  const tabId = tab?.id
  if (!(await getToken())) {
    await browser.tabs.create({ url: signInUrl(browser.runtime.id) })
    return
  }

  const pageUrl = isWeb(tab?.url) ? tab!.url : undefined
  const base = {
    id: newId(),
    source: 'EXTENSION' as const,
    capturedAt: new Date(),
    tags: [],
    url: pageUrl,
    pageTitle: clip(tab?.title, 500),
    favicon: isWeb(tab?.favIconUrl) ? clip(tab!.favIconUrl, 2000) : undefined,
  }
  let input: CreateItemInput
  let files: OutboxFile[] = []
  let saved: SavedKind = info.menuItemId as SavedKind
  let message: string | undefined

  switch (info.menuItemId as MenuId) {
    case 'highlight': {
      const quote =
        tabId === undefined ? info.selectionText : await selectedText(tabId, info.selectionText)
      input = { ...base, kind: 'HIGHLIGHT', quote: clip(quote, 20_000) }
      break
    }
    case 'page':
      input = { ...base, kind: 'LINK' }
      break
    case 'link':
      input = {
        ...base,
        kind: 'LINK',
        url: isWeb(info.linkUrl) ? info.linkUrl : pageUrl,
        pageTitle: undefined,
      }
      break
    case 'image': {
      const file = info.srcUrl ? await fetchImage(info.srcUrl) : null
      if (file) {
        input = { ...base, kind: 'IMAGE' }
        files = [file]
      } else {
        // Saved as a link to the image instead.
        input = { ...base, kind: 'LINK', url: isWeb(info.srcUrl) ? info.srcUrl : pageUrl }
        saved = 'link'
        message = s.imageAsLink
      }
      break
    }
    case 'screenshot': {
      const shot = await browser.tabs.captureVisibleTab(tab!.windowId!, { format: 'png' })
      input = { ...base, kind: 'IMAGE' }
      files = [await dataUrlFile(shot, 'SCREENSHOT')]
      break
    }
    default:
      return
  }

  if (!input.url && !input.quote && !files.length) {
    await feedback(tabId, input.id, s.failed, true)
    return
  }
  await capture(input, files)
  await feedback(tabId, input.id, message ?? s.saved[saved])
}

// ───────────────────────── Notifications ─────────────────────────

async function openApp(path: string) {
  await browser.tabs.create({ url: `${APP_URL}${path}` })
}

function onPush(event: PushEventLike) {
  let data: PushPayload | null
  try {
    data = (event.data?.json() as PushPayload) ?? null
  } catch {
    data = null
  }
  if (!data || (data.type !== 'reminder' && data.type !== 'digest')) return
  event.waitUntil(
    sw.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      requireInteraction: data.type === 'reminder',
      icon: browser.runtime.getURL('/icon/128.png'),
      data,
      // Chrome shows up to two buttons.
      actions: data.actions.slice(0, 2),
    } as NotificationOptions),
  )
}

function onNotificationClick(event: NotificationEventLike) {
  const data = event.notification.data
  event.notification.close()
  if (!data) return
  const run: Record<string, () => Promise<unknown>> =
    data.type === 'reminder'
      ? {
          done: () => api.update(data.itemId, { status: 'DONE' }),
          'snooze-1h': () => api.snooze(data.reminderId, { preset: '1h' }),
          'snooze-tomorrow': () => api.snooze(data.reminderId, { preset: 'tomorrow' }),
        }
      : data.reviewItemId
        ? {
            'review-got': () => api.answerReview(data.reviewItemId!, true),
            'review-forgot': () => api.answerReview(data.reviewItemId!, false),
          }
        : {}
  const action = run[event.action]
  event.waitUntil(action ? action().catch(() => openApp(data.url)) : openApp(data.url))
}

// ───────────────────────── Wiring ─────────────────────────

export default defineBackground({
  type: 'module',
  main() {
    // Service-worker events must be registered synchronously, on every start.
    sw.addEventListener('push', onPush)
    sw.addEventListener('notificationclick', onNotificationClick)

    browser.runtime.onInstalled.addListener(() => {
      void createMenus()
      void browser.alarms.create('flush', { periodInMinutes: 1 })
      void browser.alarms.create('refresh', { periodInMinutes: 12 * 60 })
    })
    browser.runtime.onStartup.addListener(() => {
      void outbox.flush(true).catch(() => undefined)
      void refreshProfile()
    })
    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'flush') void outbox.flush().catch(() => undefined)
      // Keeps the session in use (so it stays valid) and the theme in sync.
      if (alarm.name === 'refresh') void refreshProfile()
    })
    browser.contextMenus.onClicked.addListener((info, tab) => void onMenu(info, tab))
    // Development builds let tests drive the menu handler (Chrome can't click menus from code).
    if (import.meta.env.MODE === 'development') {
      Object.assign(globalThis, { ombDebug: { onMenu } })
    }

    // From the popup and the in-page toast.
    browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
      const message = raw as ExtensionMessage
      const work = (async () => {
        switch (message.type) {
          case 'omb:capture': {
            const files = message.screenshot
              ? [await dataUrlFile(message.screenshot, 'SCREENSHOT')]
              : []
            await capture(message.input, files)
            if (message.tabId !== undefined) {
              await feedback(message.tabId, message.input.id, (await t()).saved.note)
            }
            return { ok: true }
          }
          case 'omb:undo':
            await undo(message.id)
            return { ok: true }
          case 'omb:note':
            await addNote(message.id, message.text)
            return { ok: true }
          case 'omb:sign-out':
            await signOut()
            return { ok: true }
          case 'omb:pending':
            return { ok: true, count: (await outbox.pending()).length }
          default:
            return { ok: false }
        }
      })()
      work.then(sendResponse, () => sendResponse({ ok: false }))
      return true
    })

    // From /auth/extension in the web app (externally_connectable).
    browser.runtime.onMessageExternal.addListener((raw, sender, sendResponse) => {
      if (!sender.url || new URL(sender.url).origin !== APP_URL) {
        sendResponse({ ok: false })
        return
      }
      const message = raw as ExtensionExternalMessage
      if (message.type === 'omb:ping') {
        sendResponse({ ok: true })
        return
      }
      if (message.type !== 'omb:token' || typeof message.token !== 'string') {
        sendResponse({ ok: false })
        return
      }
      void (async () => {
        await setToken(message.token)
        await refreshProfile()
        const signedIn = Boolean((await getSession()).profile)
        sendResponse({ ok: signedIn })
        if (!signedIn) return
        await createMenus()
        await ensurePush()
        await outbox.flush(true).catch(() => undefined)
      })()
      return true
    })
  },
})
