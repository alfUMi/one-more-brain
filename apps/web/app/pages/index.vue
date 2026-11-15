<script setup lang="ts">
const { t } = useI18n()
useHead({ title: () => t('inbox.title') })
</script>

<template>
  <section class="flex max-w-[820px] flex-col gap-[18px]">
    <header class="flex items-baseline gap-3">
      <h1 class="text-[30px] font-bold">{{ t('inbox.title') }}</h1>
    </header>

    <div
      class="flex flex-col gap-2.5 rounded-lg border-2 border-(--omb-accent) bg-(--omb-surface) px-4 pt-3.5 pb-3 shadow-[0_6px_20px_rgba(15,118,110,0.12)]"
    >
      <textarea
        :aria-label="t('inbox.captureLabel')"
        :placeholder="t('inbox.capturePlaceholder')"
        rows="2"
        disabled
        class="resize-none border-0 bg-transparent text-[17px] leading-normal font-medium outline-0 placeholder:text-(--omb-text-muted) placeholder:font-normal"
      />
      <div class="flex items-center justify-end gap-2">
        <UButton :label="t('inbox.save')" disabled class="h-9 rounded-md px-3.5 font-semibold" />
      </div>
    </div>

    <div
      class="flex flex-col items-center gap-2 rounded-[14px] border border-(--omb-border) bg-(--omb-surface) px-6 py-12 text-center"
    >
      <span
        class="mb-1 flex size-10 items-center justify-center rounded-[10px] bg-(--omb-accent-soft) text-(--omb-accent)"
      >
        <UIcon name="i-lucide-inbox" class="size-5" />
      </span>
      <h2 class="text-lg font-semibold">{{ t('inbox.emptyTitle') }}</h2>
      <p class="max-w-sm text-sm text-(--omb-text-muted)">{{ t('inbox.emptyBody') }}</p>
    </div>
  </section>
</template>
