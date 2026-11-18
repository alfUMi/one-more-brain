<script setup lang="ts">
/** Settings: the same top bar, then the sections as a row of pills (mockup: Settings › Appearance). */
const { t } = useI18n()
const route = useRoute()
const sidebar = useSidebar()
onMounted(sidebar.refresh)

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
  <div class="flex min-h-dvh flex-col">
    <AppTopBar />
    <main
      class="mx-auto flex w-full max-w-[760px] min-w-0 flex-1 flex-col gap-5 px-4 pt-8 pb-20 md:px-6 md:pt-12"
    >
      <div class="flex flex-col gap-1.5">
        <h1 class="text-[36px] leading-tight font-semibold">{{ t('settings.title') }}</h1>
        <span class="text-[15px] text-(--omb-text-muted)">{{ t('settings.synced') }}</span>
      </div>
      <nav :aria-label="t('settings.sectionsLabel')" class="flex flex-wrap gap-0.5">
        <NuxtLink
          v-for="s in sections"
          :key="s"
          :to="`/settings/${s}`"
          :class="[
            'omb-btn shrink-0 text-[13.5px]',
            route.path === `/settings/${s}`
              ? 'omb-btn-primary'
              : 'omb-btn-ghost text-(--omb-text-toned)',
          ]"
        >
          {{ t(`settings.sections.${s}`) }}
        </NuxtLink>
      </nav>
      <slot />
    </main>
  </div>
</template>
