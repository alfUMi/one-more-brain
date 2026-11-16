import { FirebaseMessaging, Importance } from '@capacitor-firebase/messaging'
import type { Router } from 'vue-router'
import { reactive } from 'vue'
import { reminderDone, snooze } from './actions'
import { isNative, platform } from './config'
import { deviceLabel } from './device'
import { t } from './i18n'
import { readJson, writeJson } from './prefs'
import { api, session } from './session'
import { loadAll, loadToday } from './store'
import { toast } from './toast'

/**
 * Notifications through Firebase Cloud Messaging (Android, and iOS via APNs). The server sends the
 * same reminders and digest as Web Push; buttons (Done, Snooze, Got it, Forgot) act from here.
 * `unavailable`: not a phone, or this build has no Firebase config.
 */
export const push = reactive({
  status: 'unknown' as 'unknown' | 'unavailable' | 'prompt' | 'denied' | 'on' | 'off',
})

const TOKEN_KEY = 'push.token'
let router: Router | null = null

interface PushData {
  type?: 'reminder' | 'digest'
  url?: string
  reminderId?: string
  itemId?: string
  reviewItemId?: string
}

function dataOf(notification: { data?: unknown }): PushData {
  const data = notification.data
  return data && typeof data === 'object' ? (data as PushData) : {}
}

/** Web paths in payloads ("/?item=…", "/today") → screens in the app. */
function route(data: PushData): string {
  if (data.itemId) return `/item/${data.itemId}`
  if (data.type === 'digest' || data.url === '/today') return '/tabs/today'
  return '/tabs/inbox'
}

async function act(actionId: string, data: PushData) {
  if (!session.token) return
  switch (actionId) {
    case 'done':
      if (data.reminderId) await reminderDone(data.reminderId)
      return
    case 'snooze-1h':
      if (data.reminderId) await snooze(data.reminderId, '1h')
      return
    case 'snooze-tomorrow':
      if (data.reminderId) await snooze(data.reminderId, 'tomorrow')
      return
    case 'review-got':
    case 'review-forgot':
      if (data.reviewItemId) {
        await api.answerReview(data.reviewItemId, actionId === 'review-got').catch(() => undefined)
        await loadToday()
      }
      return
    default:
      await router?.push(route(data))
  }
}

async function register(token: string) {
  await writeJson(TOKEN_KEY, token)
  await api.registerFcm({ token, label: await deviceLabel() })
}

async function currentToken(): Promise<string | null> {
  try {
    return (await FirebaseMessaging.getToken()).token
  } catch {
    return null
  }
}

/** On start: listeners, Android channels, and the current permission. */
export async function initPush(appRouter: Router) {
  router = appRouter
  if (!isNative) {
    push.status = 'unavailable'
    return
  }
  try {
    const { isSupported } = await FirebaseMessaging.isSupported()
    if (!isSupported) throw new Error('unsupported')
  } catch {
    push.status = 'unavailable'
    return
  }
  push.status = 'off'
  if (platform === 'android') {
    await FirebaseMessaging.createChannel({
      id: 'reminders',
      name: t('mobile.remind.title'),
      importance: Importance.High,
      vibration: true,
    }).catch(() => undefined)
    await FirebaseMessaging.createChannel({
      id: 'digest',
      name: t('settings.digest'),
      importance: Importance.Default,
    }).catch(() => undefined)
  }
  await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
    if (session.token && push.status === 'on') void register(token).catch(() => undefined)
  })
  await FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
    // In the foreground the system shows nothing on Android: a toast instead, and fresh data.
    if (notification.title) void toast(notification.title)
    void loadAll()
  })
  await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    void act(event.actionId, dataOf(event.notification))
  })
  await syncPush()
}

/** Re-registers this phone if notifications are allowed (tokens can rotate). */
export async function syncPush() {
  // Runs only after initPush found Firebase on this phone.
  if (!isNative || push.status === 'unavailable' || push.status === 'unknown') return
  const { receive } = await FirebaseMessaging.checkPermissions()
  if (receive === 'denied') {
    push.status = 'denied'
    return
  }
  if (receive !== 'granted') {
    push.status = 'prompt'
    return
  }
  const turnedOff = await readJson<boolean>('push.off')
  if (turnedOff || !session.token) {
    push.status = 'off'
    return
  }
  const token = await currentToken()
  if (!token) {
    push.status = 'unavailable'
    return
  }
  await register(token).catch(() => undefined)
  push.status = 'on'
}

/** Settings › Notifications: ask for permission and register. */
export async function enablePush(): Promise<boolean> {
  if (push.status === 'unavailable') return false
  const { receive } = await FirebaseMessaging.requestPermissions()
  if (receive !== 'granted') {
    push.status = 'denied'
    return false
  }
  await writeJson('push.off', null)
  await syncPush()
  return push.status === 'on'
}

/** Stops notifications on this phone (also on sign out). */
export async function disablePush({ remember = true } = {}) {
  const token = (await readJson<string>(TOKEN_KEY)) ?? (await currentToken())
  if (token) await api.unregisterFcm(token).catch(() => undefined)
  await FirebaseMessaging.deleteToken().catch(() => undefined)
  await writeJson(TOKEN_KEY, null)
  if (remember) await writeJson('push.off', true)
  if (push.status !== 'unavailable') push.status = 'off'
}
