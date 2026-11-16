<script setup lang="ts">
import { EXTENSION_UA_PREFIX, MOBILE_UA_PREFIX } from '@omb/shared'

definePageMeta({ layout: 'settings' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.sections.devices')} · ${t('settings.title')}` })

const fmt = useFormat()
const toast = useToast()

interface SessionRow {
  id: string
  token: string
  userAgent?: string | null
  updatedAt: string | Date
}
interface PushRow {
  id: string
  label: string | null
  lastSeenAt: string | null
  createdAt: string
}

const sessions = ref<SessionRow[]>([])
const currentToken = ref<string | null>(null)
const pushDevices = ref<PushRow[]>([])

/** "Chrome on macOS" from a user agent, like the push labels. */
function browserName(ua?: string | null): string {
  if (!ua) return t('settings.unknownBrowser')
  if (ua.startsWith(EXTENSION_UA_PREFIX)) {
    return `${t('settings.extension')} · ${browserName(ua.slice(EXTENSION_UA_PREFIX.length).trim())}`
  }
  if (ua.startsWith(MOBILE_UA_PREFIX)) {
    const device = ua.slice(MOBILE_UA_PREFIX.length).trim()
    return device ? `${t('settings.mobileApp')} · ${device}` : t('settings.mobileApp')
  }
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

async function load() {
  // Better Auth's own endpoints (same origin, session cookie).
  const [list, current, push] = await Promise.all([
    $fetch<SessionRow[]>('/api/auth/list-sessions').catch(() => []),
    $fetch<{ session: { token: string } } | null>('/api/auth/get-session').catch(() => null),
    $fetch<PushRow[]>('/api/v1/push/subscriptions').catch(() => []),
  ])
  sessions.value = [...list].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  currentToken.value = current?.session.token ?? null
  pushDevices.value = push
}
onMounted(load)

async function revoke(row: SessionRow) {
  await $fetch('/api/auth/revoke-session', { method: 'POST', body: { token: row.token } }).catch(
    () => toast.add({ title: t('toasts.saveFailed'), color: 'error' }),
  )
  await load()
}

async function stopPush(row: PushRow) {
  await $fetch(`/api/v1/push/subscriptions/${row.id}` as string, { method: 'DELETE' }).catch(() =>
    toast.add({ title: t('toasts.saveFailed'), color: 'error' }),
  )
  await load()
}
</script>

<template>
  <div class="flex max-w-[680px] flex-col gap-[18px]">
    <SettingsHeader :title="t('settings.sections.devices')" />

    <section class="omb-card gap-0!" aria-labelledby="sessions-h">
      <div class="flex flex-col gap-1 pb-3">
        <h3 id="sessions-h" class="text-sm font-semibold">{{ t('settings.sessions') }}</h3>
        <span class="omb-hint">{{ t('settings.sessionsHint') }}</span>
      </div>
      <div
        v-for="row in sessions"
        :key="row.id"
        class="flex items-center gap-3 border-t border-(--omb-border-muted) py-3"
      >
        <UIcon
          :name="
            row.userAgent?.startsWith(EXTENSION_UA_PREFIX)
              ? 'i-lucide-puzzle'
              : row.userAgent?.startsWith(MOBILE_UA_PREFIX)
                ? 'i-lucide-smartphone'
                : 'i-lucide-monitor-smartphone'
          "
          class="size-[18px] text-(--omb-text-muted)"
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-medium">
            {{ browserName(row.userAgent) }}
            <span
              v-if="row.token === currentToken"
              class="omb-chip omb-chip-tag ml-1.5 h-5 text-[11px]"
            >
              {{ t('settings.thisDevice') }}
            </span>
          </span>
          <span class="omb-hint">
            {{
              t('settings.lastActive', {
                when: fmt.relative(new Date(row.updatedAt).toISOString()),
              })
            }}
          </span>
        </div>
        <UButton
          v-if="row.token !== currentToken"
          color="neutral"
          variant="outline"
          size="sm"
          @click="revoke(row)"
        >
          {{ t('settings.revoke') }}
        </UButton>
      </div>
    </section>

    <section class="omb-card gap-0!" aria-labelledby="push-devices-h">
      <h3 id="push-devices-h" class="pb-3 text-sm font-semibold">
        {{ t('settings.pushDevices') }}
      </h3>
      <p v-if="!pushDevices.length" class="omb-hint m-0 border-t border-(--omb-border-muted) pt-3">
        {{ t('settings.noPushDevices') }}
      </p>
      <div
        v-for="row in pushDevices"
        :key="row.id"
        class="flex items-center gap-3 border-t border-(--omb-border-muted) py-3"
      >
        <UIcon name="i-lucide-bell" class="size-[18px] text-(--omb-text-muted)" />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-medium">{{ row.label ?? t('settings.unknownBrowser') }}</span>
          <span class="omb-hint">
            {{ t('settings.lastActive', { when: fmt.relative(row.lastSeenAt ?? row.createdAt) }) }}
          </span>
        </div>
        <UButton color="neutral" variant="outline" size="sm" @click="stopPush(row)">
          {{ t('settings.stopPush') }}
        </UButton>
      </div>
    </section>
  </div>
</template>
