<script setup lang="ts">
/** The slim top bar from the mockups: sections, search, + Capture and the account menu. */
const { t } = useI18n()
const { user, signOut } = useCurrentUser()
const route = useRoute()
const sidebar = useSidebar()

const nav = computed(() => [
  { label: t('nav.inbox'), to: '/', count: sidebar.inboxCount.value },
  { label: t('nav.today'), to: '/today', count: sidebar.todayCount.value },
  { label: t('nav.review'), to: '/review', count: sidebar.reviewCount.value },
  { label: t('nav.library'), to: '/library', count: null },
])

/** The search box sends you to the library, which keeps the query in the URL. */
const query = ref('')
function submitSearch() {
  const q = query.value.trim()
  if (q) void navigateTo({ path: '/library', query: { q } })
}

/** "+ Capture" opens the inbox with the capture box focused. */
function capture() {
  void navigateTo({ path: '/', query: { capture: String(Date.now()) } })
}

// "/" jumps to search from anywhere.
const searchInput = useTemplateRef('searchInput')
function onKeydown(e: KeyboardEvent) {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
  if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable="true"]')) return
  if (route.path === '/library') return // the library focuses its own search box
  e.preventDefault()
  searchInput.value?.focus()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const initial = computed(() => (user.value?.email ?? '?').slice(0, 1).toUpperCase())
const userMenu = computed(() => [
  [{ label: user.value?.email ?? '', type: 'label' as const }],
  [{ label: t('nav.settings'), icon: 'i-lucide-settings', to: '/settings' }],
  [{ label: t('auth.signOut'), icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <header
    class="sticky top-0 z-20 flex flex-wrap items-center gap-x-[18px] gap-y-2 border-b border-(--omb-border-muted) bg-(--omb-bg)/90 px-4 py-3.5 backdrop-blur md:px-7"
  >
    <NuxtLink
      to="/"
      class="flex items-center gap-[9px] text-[15px] font-semibold tracking-[-0.01em]"
    >
      <AppLogo class="size-[22px]" />
      {{ t('app.name') }}
    </NuxtLink>

    <nav
      :aria-label="t('nav.main')"
      class="order-4 flex w-full flex-wrap gap-0.5 lg:order-none lg:ml-[18px] lg:w-auto"
    >
      <NuxtLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        :class="['omb-top', route.path === item.to && 'omb-top-active']"
      >
        {{ item.label }}
        <span v-if="item.count" class="omb-count">{{ item.count }}</span>
      </NuxtLink>
    </nav>

    <span class="order-1 flex-1 lg:order-none" />

    <form
      role="search"
      class="order-5 w-full lg:order-none lg:w-auto"
      @submit.prevent="submitSearch"
    >
      <label
        class="flex h-9 items-center gap-2 rounded-full bg-(--omb-hover) px-3.5 text-sm text-(--omb-text-muted) lg:min-w-[220px]"
      >
        <UIcon name="i-lucide-search" class="size-4 flex-none" />
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          :placeholder="t('nav.search')"
          :aria-label="t('inbox.search')"
          class="w-full border-0 bg-transparent text-(--omb-text) outline-none"
          @keydown.esc="($event.target as HTMLInputElement).blur()"
        />
        <span class="omb-kbd hidden sm:inline-flex">/</span>
      </label>
    </form>

    <button
      type="button"
      class="omb-btn omb-btn-primary order-2 h-9 px-4 text-sm lg:order-none"
      @click="capture"
    >
      + {{ t('nav.capture') }}
    </button>

    <UDropdownMenu :items="userMenu" :content="{ align: 'end' }">
      <button
        type="button"
        :aria-label="t('nav.account')"
        :class="[
          'order-3 flex size-9 flex-none items-center lg:order-none justify-center rounded-full bg-(--omb-surface) text-[13px] font-semibold shadow-[0_1px_2px_rgba(17,17,17,0.06)]',
          route.path.startsWith('/settings') && 'ring-2 ring-(--omb-accent)',
        ]"
      >
        {{ initial }}
      </button>
    </UDropdownMenu>
  </header>
</template>

<style scoped>
.omb-top {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 13px;
  border-radius: 999px;
  color: var(--omb-text-toned);
  font-size: 14px;
  font-weight: 500;
}
.omb-top:hover {
  background: var(--omb-hover);
}
.omb-top-active,
.omb-top-active:hover {
  background: var(--omb-surface);
  color: var(--omb-text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(17, 17, 17, 0.06);
}
.omb-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--omb-text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
