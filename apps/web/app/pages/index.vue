<script setup lang="ts">
const { t } = useI18n()
useHead({ title: () => t('inbox.title') })
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-6">
    <h1 class="font-display text-3xl font-bold">{{ t('inbox.title') }}</h1>

    <UTextarea
      :placeholder="t('inbox.capturePlaceholder')"
      :rows="2"
      autoresize
      disabled
      class="w-full"
    />

    <UEmpty
      icon="i-lucide-inbox"
      :title="t('inbox.emptyTitle')"
      :description="t('inbox.emptyBody')"
      variant="naked"
    />
  </div>
</template>
