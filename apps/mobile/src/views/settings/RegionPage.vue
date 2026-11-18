<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsShell from '../../components/settings/SettingsShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import { session, updateProfile } from '../../lib/session'
import { saveFailed } from '../../lib/toast'

/** Settings › Language & region. */
const { t } = useI18n()

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
] as const

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const zones: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf(
      'timeZone',
    )
  } catch {
    return [deviceZone, 'UTC']
  }
})()

const search = ref('')
const matches = computed(() => {
  const q = search.value.trim().toLowerCase().replace(/\s+/g, '_')
  if (!q) return []
  return zones.filter((z) => z.toLowerCase().includes(q)).slice(0, 30)
})

async function save(patch: Parameters<typeof updateProfile>[0]) {
  if (!(await updateProfile(patch))) void saveFailed()
}

async function setZone(zone: string) {
  search.value = ''
  await save({ timezone: zone })
}
</script>

<template>
  <SettingsShell
    :title="t('settings.sections.region')"
    :back="t('settings.title')"
    back-to="/settings"
  >
    <span class="cap">{{ t('settings.language') }}</span>
    <div class="group pad">
      <div class="omb-segment" role="group" :aria-label="t('settings.language')">
        <button
          v-for="lang in LANGS"
          :key="lang.code"
          type="button"
          :lang="lang.code"
          :aria-pressed="session.profile?.locale === lang.code"
          @click="save({ locale: lang.code })"
        >
          {{ lang.label }}
        </button>
      </div>
      <p class="omb-hint">{{ t('settings.languageHint') }}</p>
    </div>

    <span class="cap">{{ t('settings.timezone') }}</span>
    <div class="group pad">
      <span class="current">{{ session.profile?.timezone }}</span>
      <p class="omb-hint">{{ t('settings.timezoneHint') }}</p>
      <button
        v-if="deviceZone && deviceZone !== session.profile?.timezone"
        type="button"
        class="omb-btn omb-btn-sm"
        @click="setZone(deviceZone)"
      >
        {{ t('mobile.settings.useDeviceZone', { zone: deviceZone }) }}
      </button>
      <label class="search">
        <AppIcon name="search" :size="18" />
        <input
          v-model="search"
          type="search"
          :placeholder="t('settings.searchZone')"
          autocapitalize="off"
          :aria-label="t('settings.searchZone')"
        />
      </label>
    </div>
    <div v-if="matches.length" class="group">
      <button v-for="zone in matches" :key="zone" type="button" class="row" @click="setZone(zone)">
        {{ zone.replace(/_/g, ' ') }}
        <AppIcon v-if="zone === session.profile?.timezone" class="val" name="check" :size="18" />
      </button>
    </div>
  </SettingsShell>
</template>

<style scoped>
.current {
  font-size: 16px;
  font-weight: 600;
}
.omb-btn-sm {
  align-self: flex-start;
}
.search {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 46px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--omb-surface-muted);
  color: var(--omb-text-muted);
}
.search input {
  flex-grow: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: 400 16px var(--ion-font-family);
  color: var(--omb-text);
}
</style>
