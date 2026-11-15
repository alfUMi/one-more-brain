<script setup lang="ts">
definePageMeta({ layout: 'settings' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.sections.export')} · ${t('settings.title')}` })
</script>

<template>
  <div class="flex max-w-[680px] flex-col gap-[18px]">
    <SettingsHeader :title="t('settings.sections.export')" />
    <SettingsComingSoon
      icon="i-lucide-download"
      :title="t('settings.exportTitle')"
      :body="t('settings.exportBody')"
      :phase="7"
    />
  </div>
</template>
