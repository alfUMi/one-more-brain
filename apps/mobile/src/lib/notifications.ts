import { BackgroundRunner } from '@capacitor/background-runner'
import type { PermissionState } from '@capacitor/core'
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import type { AppSchedule } from '@omb/shared'
import type { Router } from 'vue-router'
import { reactive } from 'vue'
import { reminderDone, snooze } from './actions'
import { onRemindersChanged } from './changes'
import { APP_URL, isNative, platform } from './config'
import { deviceLabel } from './device'
import { t } from './i18n'
import { readJson, writeJson } from './prefs'
import { api, session } from './session'
import { loadAll, loadToday } from './store'

/**
 * Reminders and the daily digest as local notifications, scheduled on the phone: no push service.
 * The app fetches its schedule (the next week) on start, on resume and after every change, and
 * replaces what is pending. A background runner (public/runners/background.js) fetches it now and
 * then while the app is closed and adds what came from other devices in the meantime.
 */
export const notifications = reactive({
  status: 'unknown' as 'unknown' | 'unavailable' | 'prompt' | 'denied' | 'on' | 'off',
  /** Android 12+: without the exact-alarm setting, a reminder may come a few minutes late. */
  exact: true,
})

/** Must match capacitor.config.ts › BackgroundRunner.label (and the iOS BGTask id). */
const RUNNER = 'app.onemorebrain.mobile.refresh'
const OFF_KEY = 'notify.off'
/** Random secret: lets the background runner read this phone's schedule and nothing else. */
const SCHEDULE_KEY = 'notify.key'
/** Notification id → what it is about, so a tap or a button knows what to act on. */
const EXTRAS_KEY = 'notify.extras'

interface Extra {
  type: 'reminder' | 'digest'
  key: string
  reminderId?: string
  itemId?: string
  reviewItemId?: string | null
}

let router: Router | null = null

/** A 31-bit id from the occurrence key (iOS and Android both take ints). */
export function notificationId(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 1 || 1
}

function extraOf(value: unknown): Extra | null {
  return value && typeof value === 'object' && 'key' in value ? (value as Extra) : null
}

async function act(actionId: string, extra: Extra | null) {
  if (!session.token) return
  switch (actionId) {
    case 'done':
      if (extra?.reminderId) await reminderDone(extra.reminderId)
      return
    case 'snooze-1h':
      if (extra?.reminderId) await snooze(extra.reminderId, '1h')
      return
    case 'snooze-tomorrow':
      if (extra?.reminderId) await snooze(extra.reminderId, 'tomorrow')
      return
    case 'review-got':
    case 'review-forgot':
      if (extra?.reviewItemId) {
        await api.answerReview(extra.reviewItemId, actionId === 'review-got').catch(() => undefined)
        await loadToday()
      }
      return
    default:
      if (extra?.itemId) await router?.push(`/item/${extra.itemId}`)
      else await router?.push(extra?.type === 'reminder' ? '/tabs/inbox' : '/tabs/today')
  }
}

function toNotifications(schedule: AppSchedule): LocalNotificationSchema[] {
  const now = Date.now()
  const list: LocalNotificationSchema[] = schedule.reminders
    .filter((r) => Date.parse(r.at) > now)
    .map((r) => ({
      id: notificationId(r.key),
      title: r.title,
      body: schedule.reminderBody,
      schedule: { at: new Date(r.at), allowWhileIdle: true },
      actionTypeId: 'reminder',
      channelId: 'reminders',
      group: `item-${r.itemId}`,
      extra: { type: 'reminder', key: r.key, reminderId: r.reminderId, itemId: r.itemId },
    }))
  const d = schedule.digest
  if (d && Date.parse(d.at) > now - 60_000) {
    list.push({
      id: notificationId(d.key),
      title: d.title,
      body: d.body,
      largeBody: d.body,
      // A test digest is due now; the system needs a moment in the future.
      schedule: { at: new Date(Math.max(Date.parse(d.at), now + 1_000)), allowWhileIdle: true },
      actionTypeId: d.reviewItemId ? 'digest-review' : 'digest',
      channelId: 'digest',
      extra: { type: 'digest', key: d.key, reviewItemId: d.reviewItemId },
    })
  }
  return list
}

/** Hands the runner what it needs, and gets back what it already scheduled itself. */
async function tellRunner(details: { key: string | null; known: string[] }): Promise<string[]> {
  try {
    const result = await BackgroundRunner.dispatchEvent<{ posted?: string[] }>({
      label: RUNNER,
      event: 'sync',
      details: { api: APP_URL, ...details },
    })
    return result?.posted ?? []
  } catch {
    return []
  }
}

/** Replaces the pending notifications with `schedule`. */
async function apply(schedule: AppSchedule, key: string) {
  const wanted = toNotifications(schedule)
  const posted = new Set(await tellRunner({ key, known: wanted.map((n) => extraOf(n.extra)!.key) }))
  const toSchedule = wanted.filter((n) => !posted.has(extraOf(n.extra)!.key))
  const keep = new Set(wanted.map((n) => n.id))

  const { notifications: pending } = await LocalNotifications.getPending()
  const stale = pending.filter((n) => !keep.has(n.id))
  if (stale.length)
    await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) })
  if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule })

  const extras: Record<number, Extra> = {}
  for (const n of wanted) extras[n.id] = extraOf(n.extra)!
  await writeJson(EXTRAS_KEY, extras)
}

async function cancelAll() {
  const { notifications: pending } = await LocalNotifications.getPending().catch(() => ({
    notifications: [],
  }))
  if (pending.length) {
    await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) })
  }
}

async function scheduleKey(): Promise<string> {
  const existing = await readJson<string>(SCHEDULE_KEY)
  if (existing) return existing
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  await writeJson(SCHEDULE_KEY, key)
  return key
}

async function permission(): Promise<PermissionState> {
  return (await LocalNotifications.checkPermissions()).display
}

async function checkExact() {
  if (platform !== 'android') return
  const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting().catch(() => ({
    exact_alarm: 'granted' as const,
  }))
  notifications.exact = exact_alarm === 'granted'
}

let running: Promise<void> | null = null
let again = false

/** Fetches the schedule and reschedules. Calls made while one runs fold into one more run. */
export function syncNotifications(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        await syncOnce()
      } while (again)
    } finally {
      running = null
    }
  })()
  return running
}

async function syncOnce() {
  if (!isNative || notifications.status === 'unavailable' || notifications.status === 'unknown') {
    return
  }
  await checkExact()
  const state = await permission()
  if (state === 'denied') {
    notifications.status = 'denied'
    return
  }
  if (state !== 'granted') {
    notifications.status = 'prompt'
    return
  }
  if ((await readJson<boolean>(OFF_KEY)) || !session.token) {
    notifications.status = 'off'
    return
  }
  notifications.status = 'on'
  const key = await scheduleKey()
  try {
    await api.registerApp({ key, label: await deviceLabel() })
    await apply(await api.notificationSchedule(), key)
  } catch {
    // Offline: what is already scheduled stays as it is.
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
/** After a change in the app: one sync a moment later, however many changes come in. */
function syncSoon() {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNotifications(), 1_500)
}

/** On start: buttons, Android channels, listeners, then the first sync. */
export async function initNotifications(appRouter: Router) {
  router = appRouter
  if (!isNative) {
    notifications.status = 'unavailable'
    return
  }
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: 'reminder',
        actions: [
          { id: 'done', title: t('notify.done'), foreground: true },
          { id: 'snooze-1h', title: t('notify.snooze1h'), foreground: true },
          { id: 'snooze-tomorrow', title: t('notify.tomorrow'), foreground: true },
        ],
      },
      {
        id: 'digest-review',
        actions: [
          { id: 'review-got', title: t('digest.gotIt'), foreground: true },
          { id: 'review-forgot', title: t('digest.forgot'), foreground: true },
        ],
      },
      { id: 'digest', actions: [] },
    ],
  }).catch(() => undefined)
  if (platform === 'android') {
    await LocalNotifications.createChannel({
      id: 'reminders',
      name: t('mobile.remind.title'),
      importance: 4,
      vibration: true,
    }).catch(() => undefined)
    await LocalNotifications.createChannel({
      id: 'digest',
      name: t('settings.digest'),
      importance: 3,
    }).catch(() => undefined)
  }
  await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    void act(event.actionId, extraOf(event.notification.extra))
  })
  // In the foreground the notification still shows; refresh what's on screen too.
  await LocalNotifications.addListener('localNotificationReceived', () => void loadAll())
  // Taps on notifications the background runner scheduled.
  await BackgroundRunner.addListener('backgroundRunnerNotificationReceived', (event) => {
    void readJson<Record<number, Extra>>(EXTRAS_KEY).then((extras) =>
      act(event.actionTypeId || 'tap', extras?.[event.notificationId] ?? null),
    )
  }).catch(() => undefined)
  onRemindersChanged(syncSoon)
  notifications.status = 'off'
  await syncNotifications()
}

/** Settings › Notifications: ask for permission and schedule. */
export async function enableNotifications(): Promise<boolean> {
  if (notifications.status === 'unavailable') return false
  const { display } = await LocalNotifications.requestPermissions()
  if (display !== 'granted') {
    notifications.status = 'denied'
    return false
  }
  await writeJson(OFF_KEY, null)
  await syncNotifications()
  return notifications.status === 'on'
}

/** Android 12+: opens the system setting that lets reminders fire on the minute. */
export async function fixExactAlarms() {
  await LocalNotifications.changeExactNotificationSetting().catch(() => undefined)
  await checkExact()
}

/** Stops notifications on this phone (also on sign out). */
export async function disableNotifications({ remember = true } = {}) {
  if (remember) await writeJson(OFF_KEY, true)
  if (!isNative) return
  await cancelAll()
  await tellRunner({ key: null, known: [] })
  const key = await readJson<string>(SCHEDULE_KEY)
  if (key) await api.unregisterApp(key).catch(() => undefined)
  await writeJson(SCHEDULE_KEY, null)
  await writeJson(EXTRAS_KEY, null)
  if (notifications.status !== 'unavailable') notifications.status = 'off'
}

/** Settings › Send a test digest: today's digest on this phone in a second. */
export async function testDigestHere(): Promise<boolean> {
  if (notifications.status !== 'on') return false
  const schedule = await api.notificationSchedule({ test: true })
  if (!schedule.digest) return false
  const [digest] = toNotifications({ ...schedule, reminders: [] })
  if (!digest) return false
  await LocalNotifications.schedule({
    notifications: [{ ...digest, id: notificationId(`test:${Date.now()}`) }],
  })
  return true
}
