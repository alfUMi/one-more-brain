<script setup lang="ts">
const { t } = useI18n()
const { user, signOut } = useCurrentUser()

const nav = computed(() => [
  { label: t('nav.inbox'), icon: 'i-lucide-inbox', to: '/' },
  { label: t('nav.today'), icon: 'i-lucide-sun', to: '/today', disabled: true },
  { label: t('nav.review'), icon: 'i-lucide-refresh-cw', to: '/review', disabled: true },
  { label: t('nav.library'), icon: 'i-lucide-book', to: '/library', disabled: true },
])

const userMenu = computed(() => [
  [{ label: user.value?.email ?? '', type: 'label' as const }],
  [{ label: t('auth.signOut'), icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <div class="flex min-h-dvh flex-col md:flex-row">
    <nav
      :aria-label="t('nav.main')"
      class="flex shrink-0 flex-col gap-1 border-b border-(--omb-border) bg-(--omb-sidebar) px-3.5 py-5 md:sticky md:top-0 md:h-dvh md:w-60 md:border-r md:border-b-0"
    >
      <div class="flex items-center gap-2.5 px-3 pt-1 pb-5">
        <AppLogo class="size-7" />
        <span class="font-display text-[17px] font-bold">{{ t('app.name') }}</span>
      </div>

      <template v-for="item in nav" :key="item.to">
        <span
          v-if="item.disabled"
          aria-disabled="true"
          class="omb-nav cursor-default opacity-50"
          :title="t('nav.soon')"
        >
          <UIcon :name="item.icon" class="size-[18px]" />
          {{ item.label }}
        </span>
        <NuxtLink v-else :to="item.to" class="omb-nav" active-class="omb-nav-active">
          <UIcon :name="item.icon" class="size-[18px]" />
          {{ item.label }}
        </NuxtLink>
      </template>

      <div class="hidden flex-1 md:block" />

      <UDropdownMenu :items="userMenu" :content="{ side: 'top', align: 'start' }">
        <button type="button" class="omb-nav">
          <UIcon name="i-lucide-circle-user" class="size-[18px] shrink-0" />
          <span class="truncate">{{ user?.email }}</span>
        </button>
      </UDropdownMenu>
    </nav>

    <main class="min-w-0 flex-1 px-4 py-6 md:px-8 md:pt-7 md:pb-12">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.omb-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--omb-text-toned);
  text-align: left;
}
a.omb-nav:hover,
button.omb-nav:hover {
  background: var(--omb-hover);
}
.omb-nav-active,
a.omb-nav-active:hover {
  background: var(--omb-accent-soft);
  color: var(--omb-accent);
  font-weight: 600;
}
</style>
