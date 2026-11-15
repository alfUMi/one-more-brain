<script setup lang="ts">
/** Settings have their own navigation (mockup: Settings › Appearance). */
const { t } = useI18n()
const route = useRoute()

const sections = [
  'account',
  'appearance',
  'region',
  'reminders',
  'notifications',
  'telegram',
  'devices',
  'export',
] as const
</script>

<template>
  <div class="flex min-h-dvh flex-col md:flex-row">
    <nav
      :aria-label="t('settings.sectionsLabel')"
      class="flex shrink-0 flex-col gap-0.5 border-b border-(--omb-border) bg-(--omb-sidebar) px-3.5 py-6 md:sticky md:top-0 md:h-dvh md:w-[260px] md:overflow-y-auto md:border-r md:border-b-0"
    >
      <NuxtLink
        to="/"
        class="flex items-center gap-1.5 px-3 pb-[18px] text-[13.5px] font-semibold text-(--omb-text-toned) hover:text-(--omb-text)"
      >
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        {{ t('settings.back') }}
      </NuxtLink>
      <h1 class="px-3 pb-3 text-[22px] font-bold">{{ t('settings.title') }}</h1>
      <div class="flex gap-0.5 overflow-x-auto md:flex-col">
        <NuxtLink
          v-for="s in sections"
          :key="s"
          :to="`/settings/${s}`"
          :class="[
            'flex h-[38px] shrink-0 items-center rounded-[9px] px-3 text-sm font-medium whitespace-nowrap',
            route.path === `/settings/${s}`
              ? 'bg-(--omb-accent-soft) font-semibold text-(--omb-accent)'
              : 'text-(--omb-text-toned) hover:bg-(--omb-hover)',
          ]"
        >
          {{ t(`settings.sections.${s}`) }}
        </NuxtLink>
      </div>
    </nav>

    <main class="min-w-0 flex-1 px-4 py-6 md:px-8 md:pt-8 md:pb-12">
      <slot />
    </main>
  </div>
</template>
