<script setup lang="ts">
import {
  ACCENT_COLORS,
  ACCENTS,
  THEMES,
  type Accent,
  type Theme,
  type UpdateMeInput,
} from '@omb/shared'
import type { Me } from '~~/server/utils/me'

const { t, setLocale } = useI18n()
useHead({ title: () => t('settings.title') })

const { user } = useCurrentUser()
const appearance = useAppearance()
const toast = useToast()
const push = usePush()

const theme = computed(() => (user.value?.theme ?? 'system') as Theme)
const accent = computed(() => (user.value?.accent ?? 'teal') as Accent)

/** Saves one change and applies it at once; rolls back the local state if the server refuses. */
async function save(patch: UpdateMeInput) {
  const previous = user.value
  if (!previous) return
  user.value = { ...previous, ...(patch as Partial<Me>) }
  try {
    user.value = await $fetch<Me>('/api/v1/me', { method: 'PATCH', body: patch })
  } catch {
    user.value = previous
    toast.add({ title: t('toasts.saveFailed'), color: 'error' })
  }
  appearance.apply(theme.value, accent.value)
  if (patch.locale) await setLocale(patch.locale)
}

// ── Theme previews (mini light/dark panels, as in the mockup) ──
const PANEL = {
  light: { bg: '#f5f6f8', line: '#d5d8df', mode: 'light' },
  dark: { bg: '#0f1115', line: '#2a2f38', mode: 'dark' },
} as const
/** Each mini panel shows the accent as it looks in that panel's mode. */
const themeCards = computed(() =>
  THEMES.map((id) => ({
    id,
    sides: [
      id === 'dark' ? PANEL.dark : PANEL.light,
      id === 'light' ? PANEL.light : PANEL.dark,
    ].map((p) => ({ ...p, accent: ACCENT_COLORS[accent.value][p.mode] })),
  })),
)

/** Swatches use the shade for the mode on screen, so Graphite stays visible in dark mode. */
const colorMode = useColorMode()
const swatch = (id: Accent) => ACCENT_COLORS[id][colorMode.value === 'dark' ? 'dark' : 'light']

// ── Time zone ──
const deviceZone = import.meta.client ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
function offsetLabel(zone: string) {
  const part = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')
  return part?.value.replace('GMT', 'UTC') ?? ''
}
const zones = computed(() =>
  (import.meta.client ? Intl.supportedValuesOf('timeZone') : ['UTC']).map((zone) => ({
    label: `${zone.replace(/_/g, ' ')} (${offsetLabel(zone)})`,
    value: zone,
  })),
)
const timezone = computed({
  get: () => user.value?.timezone ?? 'UTC',
  set: (zone: string) => void save({ timezone: zone }),
})

// ── Notifications on this device ──
const pushOn = ref(false)
const pushBusy = ref(false)
onMounted(async () => (pushOn.value = await push.isSubscribed()))
const pushStatus = computed(() => {
  if (!push.supported) return t('settings.pushUnsupported')
  if (push.permission.value === 'denied') return t('settings.pushBlocked')
  return pushOn.value ? t('settings.pushOn') : t('settings.pushOff')
})
async function togglePush(on: boolean) {
  pushBusy.value = true
  try {
    if (on) await push.enable()
    else await push.disable()
  } catch {
    toast.add({ title: t('push.failed'), color: 'error' })
  } finally {
    pushOn.value = await push.isSubscribed()
    pushBusy.value = false
  }
}

const choice = (selected: boolean) => [
  'rounded-[14px] bg-(--omb-surface) text-left transition-colors',
  selected
    ? 'border-2 border-(--omb-accent)'
    : 'border border-(--omb-border) hover:border-(--omb-text-muted)',
]
</script>

<template>
  <section class="flex max-w-[680px] flex-col gap-[18px]">
    <header class="flex flex-col gap-1">
      <h1 class="text-[30px] font-bold">{{ t('settings.title') }}</h1>
      <p class="text-sm text-(--omb-text-muted)">{{ t('settings.synced') }}</p>
    </header>

    <h2 class="pt-2 text-lg font-semibold">{{ t('settings.appearance') }}</h2>

    <div class="omb-card">
      <div class="flex flex-col gap-1">
        <h3 id="theme-h" class="text-sm font-semibold">{{ t('settings.theme') }}</h3>
        <span class="omb-hint">{{ t('settings.themeHint') }}</span>
      </div>
      <div role="radiogroup" aria-labelledby="theme-h" class="grid grid-cols-3 gap-2.5">
        <button
          v-for="card in themeCards"
          :key="card.id"
          type="button"
          role="radio"
          :aria-checked="theme === card.id"
          :class="[choice(theme === card.id), 'flex flex-col gap-2.5 p-2.5 text-sm font-semibold']"
          @click="save({ theme: card.id })"
        >
          <span
            aria-hidden="true"
            class="flex h-16 overflow-hidden rounded-[9px] border border-(--omb-border)"
          >
            <span
              v-for="(side, i) in card.sides"
              :key="i"
              class="flex flex-1 flex-col gap-[5px] p-2"
              :style="{ background: side.bg }"
            >
              <span class="h-1.5 w-3/5 rounded-[3px]" :style="{ background: side.line }" />
              <span class="h-1.5 w-4/5 rounded-[3px]" :style="{ background: side.line }" />
              <span class="h-2.5 w-2/5 rounded-[3px]" :style="{ background: side.accent }" />
            </span>
          </span>
          {{ t(`settings.themes.${card.id}`) }}
        </button>
      </div>
    </div>

    <div class="omb-card">
      <div class="flex flex-col gap-1">
        <h3 id="accent-h" class="text-sm font-semibold">{{ t('settings.accent') }}</h3>
        <span class="omb-hint">{{ t('settings.accentHint') }}</span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="accent-h"
        class="grid grid-cols-3 gap-2.5 sm:grid-cols-5"
      >
        <button
          v-for="id in ACCENTS"
          :key="id"
          type="button"
          role="radio"
          :aria-checked="accent === id"
          :class="[
            choice(accent === id),
            'flex flex-col items-center gap-2 px-1.5 py-3 text-[13px] font-medium',
          ]"
          @click="save({ accent: id })"
        >
          <span
            aria-hidden="true"
            class="flex size-10 items-center justify-center rounded-full"
            :style="{
              background: swatch(id),
              boxShadow:
                accent === id ? `0 0 0 3px var(--omb-surface), 0 0 0 5px ${swatch(id)}` : 'none',
            }"
          >
            <UIcon
              v-if="accent === id"
              name="i-lucide-check"
              class="size-[18px] text-(--omb-on-accent)"
            />
          </span>
          {{ t(`settings.accents.${id}`) }}
        </button>
      </div>
    </div>

    <h2 class="pt-2 text-lg font-semibold">{{ t('settings.region') }}</h2>

    <div class="omb-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 id="lang-h" class="text-sm font-semibold">{{ t('settings.language') }}</h3>
        <div role="radiogroup" aria-labelledby="lang-h" class="flex gap-1">
          <button
            v-for="l in [
              { code: 'en', name: 'English' },
              { code: 'ru', name: 'Русский' },
            ] as const"
            :key="l.code"
            type="button"
            role="radio"
            :aria-checked="user?.locale === l.code"
            :class="[
              'h-9 rounded-lg border px-3.5 text-sm font-medium',
              user?.locale === l.code
                ? 'border-(--omb-accent) bg-(--omb-accent-soft) text-(--omb-accent)'
                : 'border-(--omb-border) hover:bg-(--omb-hover)',
            ]"
            @click="save({ locale: l.code })"
          >
            {{ l.name }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2 border-t border-(--omb-border-muted) pt-4">
        <label for="tz" class="text-sm font-semibold">{{ t('settings.timezone') }}</label>
        <span class="omb-hint">{{ t('settings.timezoneHint') }}</span>
        <USelectMenu
          id="tz"
          v-model="timezone"
          :items="zones"
          value-key="value"
          :search-input="{ placeholder: t('settings.searchZone') }"
          class="w-full sm:w-96"
          size="lg"
        />
        <UButton
          v-if="deviceZone !== timezone"
          color="neutral"
          variant="link"
          class="self-start px-0"
          @click="timezone = deviceZone"
        >
          {{ t('settings.useDevice', { zone: deviceZone }) }}
        </UButton>
      </div>
    </div>

    <h2 class="pt-2 text-lg font-semibold">{{ t('settings.notifications') }}</h2>

    <div class="omb-card">
      <div class="flex items-center gap-4">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span id="push-h" class="text-sm font-semibold">{{ t('settings.pushThisDevice') }}</span>
          <span class="omb-hint">{{ pushStatus }}</span>
        </div>
        <USwitch
          :model-value="pushOn"
          :loading="pushBusy"
          :disabled="!push.supported || push.permission.value === 'denied'"
          aria-labelledby="push-h"
          @update:model-value="togglePush"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.omb-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 24px;
  border: 1px solid var(--omb-border);
  border-radius: 16px;
  background: var(--omb-surface);
}
.omb-hint {
  font-size: 13px;
  color: var(--omb-text-muted);
}
</style>
