<script setup lang="ts">
import { alertController, onIonViewWillEnter } from '@ionic/vue'
import { ACCENTS, THEMES, type Accent, type Theme } from '@omb/shared'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppIcon from '../../components/AppIcon.vue'
import SettingsShell from '../../components/settings/SettingsShell.vue'
import { accentHex, asAccent, asTheme } from '../../lib/appearance'
import { APP_HOST, APP_VERSION } from '../../lib/config'
import { disablePush, push } from '../../lib/push'
import { api, session, signOut, updateProfile } from '../../lib/session'
import { saveFailed } from '../../lib/toast'

/** Mockup: Mobile · Settings. Opened from the gear on Capture. */
const { t } = useI18n()
const router = useRouter()

const profile = computed(() => session.profile)
const theme = computed(() => asTheme(profile.value?.theme))
const accent = computed(() => asAccent(profile.value?.accent))
const initial = computed(() =>
  (profile.value?.name || profile.value?.email || '?').trim().charAt(0).toUpperCase(),
)

async function setTheme(value: Theme) {
  if (!(await updateProfile({ theme: value }))) void saveFailed()
}
async function setAccent(value: Accent) {
  if (!(await updateProfile({ accent: value }))) void saveFailed()
}

const deviceCount = ref<number | null>(null)
onIonViewWillEnter(async () => {
  deviceCount.value = (await api.sessions().catch(() => null))?.length ?? null
})

const regionValue = computed(() => {
  const p = profile.value
  if (!p) return ''
  return `${p.locale === 'ru' ? 'Русский' : 'English'} · ${p.timezone}`
})
const digestValue = computed(() =>
  profile.value?.digestEnabled
    ? `${t('settings.digest')} ${profile.value.digestTime}`
    : t('mobile.settings.notificationsOff'),
)
const pushValue = computed(() =>
  push.status === 'on'
    ? t('mobile.settings.notificationsOn')
    : t('mobile.settings.notificationsOff'),
)

async function confirmSignOut() {
  const alert = await alertController.create({
    header: t('mobile.settings.signOutConfirm'),
    message: t('mobile.settings.signOutHint'),
    buttons: [
      { text: t('actions.cancel'), role: 'cancel' },
      { text: t('settings.signOut'), role: 'destructive' },
    ],
  })
  await alert.present()
  const { role } = await alert.onDidDismiss()
  if (role !== 'destructive') return
  await disablePush({ remember: false })
  await signOut()
}
</script>

<template>
  <SettingsShell
    :title="t('settings.title')"
    :back="t('mobile.tabs.capture')"
    back-to="/tabs/capture"
  >
    <div class="group">
      <button type="button" class="row account" @click="router.push('/settings/account')">
        <span class="avatar">{{ initial }}</span>
        <span class="who">
          <span>{{ profile?.name || t('settings.sections.account') }}</span>
          <span class="email">{{ profile?.email }}</span>
        </span>
        <AppIcon class="chev" name="chevron-right" :size="18" />
      </button>
    </div>

    <span class="cap">{{ t('settings.sections.appearance') }}</span>
    <div class="group pad">
      <div class="omb-segment" role="group" :aria-label="t('settings.theme')">
        <button
          v-for="value in THEMES"
          :key="value"
          type="button"
          :aria-pressed="theme === value"
          @click="setTheme(value)"
        >
          {{ t(`settings.themes.${value}`) }}
        </button>
      </div>
      <div class="accents" role="group" :aria-label="t('settings.accent')">
        <span class="accent-label">{{ t('settings.accent') }}</span>
        <button
          v-for="value in ACCENTS"
          :key="value"
          type="button"
          class="swatch"
          :class="{ on: accent === value }"
          :style="{ background: accentHex(value), color: accentHex(value) }"
          :aria-label="t(`settings.accents.${value}`)"
          :aria-pressed="accent === value"
          @click="setAccent(value)"
        />
      </div>
      <p class="omb-hint">{{ t('settings.synced') }}</p>
    </div>

    <span class="cap">{{ t('mobile.settings.general') }}</span>
    <div class="group">
      <button type="button" class="row" @click="router.push('/settings/region')">
        {{ t('settings.sections.region') }}<span class="val">{{ regionValue }}</span>
      </button>
      <button type="button" class="row" @click="router.push('/settings/reminders')">
        {{ t('settings.sections.reminders') }}<span class="val">{{ digestValue }}</span>
      </button>
      <button type="button" class="row" @click="router.push('/settings/notifications')">
        {{ t('settings.sections.notifications') }}<span class="val">{{ pushValue }}</span>
      </button>
      <button type="button" class="row" @click="router.push('/settings/devices')">
        {{ t('settings.sections.devices') }}<span class="val">{{ deviceCount ?? '' }}</span>
      </button>
      <button type="button" class="row" disabled>
        {{ t('settings.sections.telegram')
        }}<span class="soon">{{ t('mobile.settings.soon', { n: 3 }) }}</span>
      </button>
      <button type="button" class="row" disabled>
        {{ t('mobile.settings.places')
        }}<span class="soon">{{ t('mobile.settings.soon', { n: 6 }) }}</span>
      </button>
      <button type="button" class="row" disabled>
        {{ t('settings.sections.export')
        }}<span class="soon">{{ t('mobile.settings.soon', { n: 7 }) }}</span>
      </button>
    </div>

    <button type="button" class="omb-btn omb-btn-danger signout" @click="confirmSignOut">
      {{ t('settings.signOut') }}
    </button>

    <span class="cap">{{ t('mobile.settings.about') }}</span>
    <div class="group">
      <div class="row">
        {{ t('mobile.settings.version') }}<span class="val">{{ APP_VERSION }}</span>
      </div>
      <div class="row">
        {{ t('mobile.settings.server') }}<span class="val">{{ APP_HOST }}</span>
      </div>
    </div>
  </SettingsShell>
</template>

<style scoped>
.account {
  min-height: 64px;
}
.avatar {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--omb-accent-soft);
  color: var(--omb-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.who {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 0;
}
.email {
  font-size: 12.5px;
  color: var(--omb-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}
.chev {
  color: var(--omb-text-muted);
}
.accents {
  display: flex;
  align-items: center;
  gap: 12px;
}
.accent-label {
  flex-grow: 1;
  font-size: 14px;
  color: var(--omb-text-toned);
}
.swatch {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 0;
  padding: 0;
}
.swatch.on {
  box-shadow:
    0 0 0 2px var(--omb-surface),
    0 0 0 4px currentColor;
}
.signout {
  margin-top: 6px;
}
</style>
