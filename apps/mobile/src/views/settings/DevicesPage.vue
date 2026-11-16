<script setup lang="ts">
import type { PushDeviceRow, SessionRow } from '@omb/api-client'
import { onIonViewWillEnter } from '@ionic/vue'
import { EXTENSION_UA_PREFIX, MOBILE_UA_PREFIX } from '@omb/shared'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '../../components/AppIcon.vue'
import SettingsShell from '../../components/settings/SettingsShell.vue'
import { formatter } from '../../lib/format'
import { api, session } from '../../lib/session'
import { saveFailed } from '../../lib/toast'

/** Settings › Devices: signed-in browsers and phones, and who gets notifications. */
const { t } = useI18n()

const sessions = ref<SessionRow[]>([])
const pushDevices = ref<PushDeviceRow[]>([])

async function load() {
  const [list, push] = await Promise.all([
    api.sessions().catch(() => [] as SessionRow[]),
    api.pushDevices().catch(() => [] as PushDeviceRow[]),
  ])
  sessions.value = [...list].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  pushDevices.value = push
}
onIonViewWillEnter(load)

function name(ua?: string | null): string {
  if (!ua) return t('settings.unknownBrowser')
  if (ua.startsWith(MOBILE_UA_PREFIX)) {
    const device = ua.slice(MOBILE_UA_PREFIX.length).trim()
    return device ? `${t('settings.mobileApp')} · ${device}` : t('settings.mobileApp')
  }
  if (ua.startsWith(EXTENSION_UA_PREFIX)) return t('settings.extension')
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : t('settings.unknownBrowser')
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
  return os ? `${browser} · ${os}` : browser
}

function icon(ua?: string | null) {
  if (ua?.startsWith(MOBILE_UA_PREFIX)) return 'phone' as const
  if (ua?.startsWith(EXTENSION_UA_PREFIX)) return 'external' as const
  return 'search' as const
}

async function revoke(row: SessionRow) {
  await api.revokeSession(row.token).catch(saveFailed)
  await load()
}

async function stop(row: PushDeviceRow) {
  await api.removePushDevice(row.id).catch(saveFailed)
  await load()
}
</script>

<template>
  <SettingsShell
    :title="t('settings.sections.devices')"
    :back="t('settings.title')"
    back-to="/settings"
  >
    <span class="cap">{{ t('settings.sessions') }}</span>
    <div class="group">
      <div v-for="row in sessions" :key="row.id" class="row device">
        <AppIcon :name="icon(row.userAgent)" :size="18" class="muted" />
        <span class="info">
          <span class="dev-name">
            {{ name(row.userAgent) }}
            <span v-if="row.token === session.token" class="omb-chip omb-chip-tag omb-chip-sm">
              {{ t('mobile.settings.thisPhone') }}
            </span>
          </span>
          <span class="omb-meta">
            {{
              t('settings.lastActive', {
                when: formatter.relative(new Date(row.updatedAt).toISOString()),
              })
            }}
          </span>
        </span>
        <button
          v-if="row.token !== session.token"
          type="button"
          class="omb-btn omb-btn-sm"
          @click="revoke(row)"
        >
          {{ t('settings.revoke') }}
        </button>
      </div>
    </div>
    <p class="omb-hint note">{{ t('settings.sessionsHint') }}</p>

    <span class="cap">{{ t('settings.pushDevices') }}</span>
    <div class="group">
      <p v-if="!pushDevices.length" class="row muted">{{ t('settings.noPushDevices') }}</p>
      <div v-for="row in pushDevices" :key="row.id" class="row device">
        <AppIcon name="bell" :size="18" class="muted" />
        <span class="info">
          <span class="dev-name">{{ row.label ?? t('settings.unknownBrowser') }}</span>
          <span class="omb-meta">
            {{
              t('settings.lastActive', {
                when: formatter.relative(row.lastSeenAt ?? row.createdAt),
              })
            }}
          </span>
        </span>
        <button type="button" class="omb-btn omb-btn-sm" @click="stop(row)">
          {{ t('settings.stopPush') }}
        </button>
      </div>
    </div>
  </SettingsShell>
</template>

<style scoped>
.device {
  padding-top: 10px;
  padding-bottom: 10px;
}
.info {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dev-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.muted {
  color: var(--omb-text-muted);
  font-size: 14px;
}
</style>
