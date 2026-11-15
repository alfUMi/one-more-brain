<script setup lang="ts">
/** Keeps a section's place in the layout until its phase ships. */
defineProps<{ icon: string; title: string; body: string; phase: number }>()
const { t } = useI18n()
</script>

<template>
  <section class="omb-card">
    <div class="flex items-start gap-3.5">
      <span
        class="flex size-10 flex-none items-center justify-center rounded-[10px] bg-(--omb-accent-soft) text-(--omb-accent)"
      >
        <UIcon :name="icon" class="size-5" />
      </span>
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-semibold">{{ title }}</h3>
        <p class="m-0 text-sm text-(--omb-text-toned)">{{ body }}</p>
        <p class="omb-hint m-0 pt-1">{{ t('settings.comingIn', { n: phase }) }}</p>
      </div>
    </div>
  </section>
</template>
