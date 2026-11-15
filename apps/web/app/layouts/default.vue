<script setup lang="ts">
const { t } = useI18n()
const { user, signOut } = useCurrentUser()
const route = useRoute()
const sidebar = useSidebar()
onMounted(sidebar.refresh)
// Keep this browser's push subscription registered (it can rotate or move between accounts).
onMounted(() => void usePush().sync())
// Offline shell for everyone (push registers the same worker), and the capture outbox.
onMounted(() => void registerServiceWorker()?.catch(() => undefined))
const outbox = useOutbox()
onMounted(outbox.start)

const nav = computed(() => [
  { label: t('nav.inbox'), icon: 'i-lucide-inbox', to: '/', count: sidebar.inboxCount.value },
  { label: t('nav.today'), icon: 'i-lucide-sun', to: '/today', count: sidebar.todayCount.value },
  {
    label: t('nav.review'),
    icon: 'i-lucide-refresh-cw',
    to: '/review',
    count: sidebar.reviewCount.value,
  },
  { label: t('nav.library'), icon: 'i-lucide-book', to: '/library' },
])

/** Most used tags; the rest are reachable from the library. */
const topTags = computed(() => sidebar.tags.value.slice(0, 10))
const activeTag = computed(() => (route.path === '/library' ? route.query.tag : null))

const userMenu = computed(() => [
  [{ label: user.value?.email ?? '', type: 'label' as const }],
  [{ label: t('auth.signOut'), icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <div class="flex min-h-dvh flex-col md:flex-row">
    <nav
      :aria-label="t('nav.main')"
      class="flex shrink-0 flex-col gap-1 border-b border-(--omb-border) bg-(--omb-sidebar) px-3.5 py-5 md:sticky md:top-0 md:h-dvh md:w-60 md:overflow-y-auto md:border-r md:border-b-0"
    >
      <div class="flex items-center gap-2.5 px-3 pt-1 pb-5">
        <AppLogo class="size-7" />
        <span class="font-display text-[17px] font-bold">{{ t('app.name') }}</span>
      </div>

      <NuxtLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        :class="['omb-nav', route.path === item.to && !activeTag && 'omb-nav-active']"
      >
        <UIcon :name="item.icon" class="size-[18px]" />
        {{ item.label }}
        <span v-if="item.count" class="omb-count">{{ item.count }}</span>
      </NuxtLink>

      <!-- One wrapper hides the whole tag list on small screens (.omb-nav sets display itself). -->
      <div v-if="topTags.length" class="hidden flex-col gap-1 md:flex">
        <div
          class="px-3 pt-[22px] pb-2 text-[11px] font-semibold tracking-[0.08em] text-(--omb-text-muted) uppercase"
        >
          {{ t('nav.tags') }}
        </div>
        <NuxtLink
          v-for="tag in topTags"
          :key="tag.name"
          :to="{ path: '/library', query: { tag: tag.name } }"
          :class="['omb-nav', activeTag === tag.name && 'omb-nav-active']"
        >
          <span class="text-(--omb-text-muted)">#</span>
          <span class="truncate">{{ tag.name }}</span>
          <span class="omb-count">{{ tag.count }}</span>
        </NuxtLink>
      </div>

      <div class="hidden flex-1 md:block" />

      <NuxtLink to="/settings" :class="['omb-nav', route.path === '/settings' && 'omb-nav-active']">
        <UIcon name="i-lucide-settings" class="size-[18px]" />
        {{ t('nav.settings') }}
      </NuxtLink>

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
.omb-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--omb-text-muted);
}
.omb-nav-active .omb-count {
  color: inherit;
}
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
