/** Web Push for this browser: subscribe, keep the subscription registered, turn off. */

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** "Chrome on macOS": shown in the device list later. */
function deviceLabel(): string {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return os ? `${browser} on ${os}` : browser
}

export function usePush() {
  const supported = import.meta.client
    ? 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    : false
  const permission = useState<NotificationPermission | 'unsupported'>('push-permission', () =>
    supported ? Notification.permission : 'unsupported',
  )

  async function subscribe(): Promise<boolean> {
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const { publicKey } = await $fetch<{ publicKey: string | null }>('/api/v1/push/key')
    if (!publicKey) return false
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      }))
    const json = subscription.toJSON()
    await $fetch('/api/v1/push/subscriptions', {
      method: 'POST',
      body: { endpoint: json.endpoint, keys: json.keys, label: deviceLabel() },
    })
    return true
  }

  /** Asks for permission and subscribes. Returns whether notifications are on. */
  async function enable(): Promise<boolean> {
    if (!supported) return false
    permission.value = await Notification.requestPermission()
    if (permission.value !== 'granted') return false
    return subscribe()
  }

  /** On app start: re-register an existing grant (subscriptions can rotate). */
  async function sync() {
    if (!supported || Notification.permission !== 'granted') return
    await subscribe().catch(() => undefined)
  }

  async function disable() {
    if (!supported) return
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return
    await $fetch('/api/v1/push/subscriptions', {
      method: 'DELETE',
      body: { endpoint: subscription.endpoint },
    }).catch(() => undefined)
    await subscription.unsubscribe()
  }

  return { supported, permission, enable, sync, disable }
}
