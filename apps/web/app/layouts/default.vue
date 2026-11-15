<script setup lang="ts">
const { t } = useI18n()
const { user, signOut } = useCurrentUser()

const nav = computed(() => [
  { label: t('nav.inbox'), icon: 'i-lucide-inbox', to: '/' },
  { label: t('nav.today'), icon: 'i-lucide-sun', to: '/today', disabled: true },
  { label: t('nav.review'), icon: 'i-lucide-repeat', to: '/review', disabled: true },
  { label: t('nav.library'), icon: 'i-lucide-library', to: '/library', disabled: true },
])

const userMenu = computed(() => [
  [{ label: user.value?.email ?? '', type: 'label' as const }],
  [{ label: t('auth.signOut'), icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-(--ui-bg-muted) md:flex-row">
    <aside
      class="flex shrink-0 flex-col gap-1 border-b border-(--ui-border) bg-(--ui-bg) p-4 md:w-60 md:border-r md:border-b-0"
    >
      <div class="flex items-center gap-2.5 px-2 pb-4">
        <AppLogo class="size-7" />
        <span class="font-display text-lg font-bold">{{ t('app.name') }}</span>
      </div>
      <UNavigationMenu :items="nav" orientation="vertical" class="flex-1" />
      <UDropdownMenu :items="userMenu">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-circle-user"
          :label="user?.email"
          class="w-full truncate"
        />
      </UDropdownMenu>
    </aside>
    <main class="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
      <slot />
    </main>
  </div>
</template>
