<script setup lang="ts">
definePageMeta({ layout: 'settings' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.sections.region')} · ${t('settings.title')}` })

const { user, save } = useProfile()

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
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
] as const
</script>

<template>
  <div class="flex max-w-[680px] flex-col gap-[18px]">
    <SettingsHeader :title="t('settings.sections.region')" :hint="t('settings.synced')" />

    <section class="omb-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h3 id="lang-h" class="text-sm font-semibold">{{ t('settings.language') }}</h3>
          <span class="omb-hint">{{ t('settings.languageHint') }}</span>
        </div>
        <div role="radiogroup" aria-labelledby="lang-h" class="flex gap-1">
          <button
            v-for="l in LANGUAGES"
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
    </section>

    <section class="omb-card gap-2!">
      <label for="tz" class="text-sm font-semibold">{{ t('settings.timezone') }}</label>
      <span class="omb-hint">{{ t('settings.timezoneHint') }}</span>
      <USelectMenu
        id="tz"
        v-model="timezone"
        :items="zones"
        value-key="value"
        :search-input="{ placeholder: t('settings.searchZone') }"
        class="mt-1 w-full sm:w-96"
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
    </section>
  </div>
</template>
