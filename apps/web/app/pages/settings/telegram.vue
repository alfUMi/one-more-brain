<script setup lang="ts">
definePageMeta({ layout: 'settings' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.sections.telegram')} · ${t('settings.title')}` })
</script>

<template>
  <div class="flex max-w-[680px] flex-col gap-[18px]">
    <SettingsHeader :title="t('settings.sections.telegram')" />
    <SettingsComingSoon
      icon="i-simple-icons-telegram"
      :title="t('settings.telegramTitle')"
      :body="t('settings.telegramBody')"
      :phase="3"
    />
  </div>
</template>
