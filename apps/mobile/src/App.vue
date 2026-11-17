<script setup lang="ts">
import { App as CapApp } from '@capacitor/app'
import { Network } from '@capacitor/network'
import { SplashScreen } from '@capacitor/splash-screen'
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import ShareSheet from './components/ShareSheet.vue'
import { completeSignIn } from './lib/auth'
import { isNative } from './lib/config'
import { t } from './lib/i18n'
import { flushOutbox, onOutbox } from './lib/outbox'
import { remindersChanged } from './lib/changes'
import { disableNotifications, initNotifications, syncNotifications } from './lib/notifications'
import { onSignedOut, refreshProfile, session } from './lib/session'
import { initShare } from './lib/share'
import { clearStore, loadAll, rememberRecent, store, upsertItem } from './lib/store'
import { toast } from './lib/toast'

const router = useRouter()

/** Everything the app does when it starts, comes back to the foreground or gets the network back. */
function refresh() {
  if (!session.token) return
  void flushOutbox(true)
  void loadAll()
}

onSignedOut(() => {
  clearStore()
  void router.replace('/sign-in')
})

onOutbox((event) => {
  if (event.type === 'synced') {
    upsertItem(event.item)
    void rememberRecent(event.item)
    // "Call mom tomorrow 9" captured offline gets its reminder once it syncs.
    remindersChanged()
  } else if (event.type === 'rejected') {
    void toast(`${t('offline.rejected')}: ${event.error}`, { error: true })
  }
})

watch(
  () => session.profile?.id,
  (id, old) => {
    if (id && id !== old) {
      refresh()
      void syncNotifications()
    }
  },
)

// The digest time, its switch, the time zone or the language move or reword notifications.
watch(
  () => {
    const p = session.profile
    return p && `${p.digestEnabled}|${p.digestTime}|${p.timezone}|${p.locale}`
  },
  (now, before) => {
    if (now && before && now !== before) remindersChanged()
  },
)

onMounted(async () => {
  if (isNative) void SplashScreen.hide().catch(() => undefined)
  // Shares can arrive any moment (also the one that launched the app): listen first.
  await initShare()
  refresh()

  const status = await Network.getStatus().catch(() => ({ connected: navigator.onLine }))
  store.online = status.connected
  await Network.addListener('networkStatusChange', ({ connected }) => {
    const back = connected && !store.online
    store.online = connected
    if (back) refresh()
  })

  await CapApp.addListener('resume', () => {
    void refreshProfile()
    refresh()
    void syncNotifications()
  })

  // Sign-in comes back as onemorebrain://auth?code=…
  await CapApp.addListener('appUrlOpen', ({ url }) => {
    completeSignIn(url)
      .then((done) => {
        if (done) void router.replace('/tabs/capture')
      })
      .catch(() => void toast(t('mobile.signIn.failed'), { error: true }))
  })

  // Notification setup must never hold up the rest of the start.
  void initNotifications(router).catch(() => undefined)

  // Sends what's waiting every 30 s while the app is open.
  setInterval(() => session.token && void flushOutbox(false), 30_000)
})

// Signing out stops notifications for this phone (they belong to the account).
onSignedOut(() => void disableNotifications({ remember: false }))
</script>

<template>
  <IonApp>
    <IonRouterOutlet />
    <ShareSheet />
  </IonApp>
</template>
