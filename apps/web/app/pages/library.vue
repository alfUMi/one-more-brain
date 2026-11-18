<script setup lang="ts">
import {
  ITEM_KINDS,
  ITEM_STATUSES,
  type ItemDto,
  type ItemKind,
  type ItemStatus,
} from '@omb/shared'

const { t } = useI18n()
useHead({ title: () => t('library.title') })

const route = useRoute()
const router = useRouter()
const api = useItemsApi()
const sidebar = useSidebar()

const pick = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  typeof value === 'string' && (list as readonly string[]).includes(value)
    ? (value as T)
    : undefined

/** Filters come from the URL, so tag links, the inbox search box and Back all work. */
const filters = computed(() => ({
  q: typeof route.query.q === 'string' ? route.query.q : '',
  tag: typeof route.query.tag === 'string' ? route.query.tag : undefined,
  status: pick<ItemStatus>(ITEM_STATUSES, route.query.status),
  kind: pick<ItemKind>(ITEM_KINDS, route.query.kind),
}))

function setFilter(patch: Partial<Record<'q' | 'tag' | 'status' | 'kind', string | undefined>>) {
  const query = Object.fromEntries(
    Object.entries({ ...route.query, ...patch }).filter(([, value]) => Boolean(value)),
  )
  void router.replace({ query })
}

// The search box updates the URL after a short pause.
const search = ref(filters.value.q)
watch(
  () => filters.value.q,
  (q) => q !== search.value && (search.value = q),
)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (q) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => setFilter({ q: q.trim() || undefined }), 250)
})

const items = ref<ItemDto[]>([])
const cursor = ref<string | null>(null)
const loading = ref(true)
let request = 0

async function load(more = false) {
  const id = ++request
  loading.value = true
  try {
    const f = filters.value
    const page = await api.list({
      q: f.q || undefined,
      tag: f.tag,
      status: f.status,
      kind: f.kind,
      cursor: more ? (cursor.value ?? undefined) : undefined,
    })
    if (id !== request) return // a newer filter won
    items.value = more ? [...items.value, ...page.items] : page.items
    cursor.value = page.nextCursor
  } finally {
    if (id === request) loading.value = false
  }
}
watch(filters, () => load(), { immediate: true, deep: true })

const hasFilters = computed(() => {
  const f = filters.value
  return Boolean(f.q || f.tag || f.status || f.kind)
})

const searchInput = useTemplateRef('searchInput')
function onKeydown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable="true"]')) return
  if (e.key === '/') {
    e.preventDefault()
    searchInput.value?.inputRef?.focus()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const segment = (active: boolean) => ['omb-btn h-8', active ? 'omb-btn-primary' : 'omb-btn-ghost']
/** Most used tags (they used to live in the sidebar); the active one stays first. */
const topTags = computed(() => {
  const names = sidebar.tags.value.slice(0, 12).map((tag) => tag.name)
  const active = filters.value.tag
  return active ? [active, ...names.filter((n) => n !== active)] : names
})
</script>

<template>
  <section class="flex flex-col gap-[18px]">
    <header class="flex flex-col gap-1.5">
      <h1 class="text-[36px] leading-tight font-semibold">{{ t('library.title') }}</h1>
      <span class="text-[15px] text-(--omb-text-muted)">{{ t('library.subtitle') }}</span>
    </header>

    <form role="search" @submit.prevent>
      <UInput
        ref="searchInput"
        v-model="search"
        type="search"
        icon="i-lucide-search"
        :placeholder="t('library.searchPlaceholder')"
        :aria-label="t('inbox.search')"
        :loading="loading && Boolean(filters.q)"
        size="xl"
        variant="none"
        class="w-full rounded-2xl bg-(--omb-surface) shadow-(--omb-shadow)"
        :ui="{ base: 'h-[52px] text-base' }"
        autofocus
        @keydown.esc="($event.target as HTMLInputElement).blur()"
      >
        <template #trailing>
          <span v-if="filters.q && !loading" class="omb-meta">
            {{ t('library.results', { n: items.length + (cursor ? '+' : '') }) }}
          </span>
          <span v-else class="omb-kbd">/</span>
        </template>
      </UInput>
    </form>

    <div class="flex flex-col gap-2.5">
      <div class="flex flex-wrap items-center gap-1">
        <div role="group" :aria-label="t('library.filterByStatus')" class="contents">
          <button
            v-for="s in ['ALL', ...ITEM_STATUSES] as const"
            :key="s"
            type="button"
            :aria-pressed="(filters.status ?? 'ALL') === s"
            :class="segment((filters.status ?? 'ALL') === s)"
            @click="setFilter({ status: s === 'ALL' ? undefined : s })"
          >
            {{ t(`statuses.${s}`) }}
          </button>
        </div>
        <span class="mx-2 h-5 w-px bg-(--omb-border)" aria-hidden="true" />
        <div role="group" :aria-label="t('inbox.filterByKind')" class="contents">
          <button
            v-for="k in ITEM_KINDS"
            :key="k"
            type="button"
            :aria-pressed="filters.kind === k"
            :class="segment(filters.kind === k)"
            @click="setFilter({ kind: filters.kind === k ? undefined : k })"
          >
            {{ t(`kinds.${k}`) }}
          </button>
        </div>
      </div>
      <div
        v-if="topTags.length"
        role="group"
        :aria-label="t('library.tags')"
        class="flex flex-wrap gap-1.5"
      >
        <template v-for="name in topTags" :key="name">
          <button
            v-if="name === filters.tag"
            type="button"
            :aria-label="t('library.removeTag')"
            class="omb-chip bg-(--omb-accent) text-(--omb-on-accent)"
            @click="setFilter({ tag: undefined })"
          >
            {{ name }} ×
          </button>
          <button
            v-else
            type="button"
            class="omb-chip omb-chip-tag hover:bg-(--omb-hover)"
            @click="setFilter({ tag: name })"
          >
            {{ name }}
          </button>
        </template>
      </div>
    </div>

    <ItemList
      v-if="items.length"
      v-model="items"
      group="month"
      :keeps-item="(i) => !filters.status || i.status === filters.status"
      @change="sidebar.refresh"
    />

    <button
      v-if="cursor"
      type="button"
      class="omb-btn omb-btn-ghost self-center"
      :disabled="loading"
      @click="load(true)"
    >
      {{ t('inbox.loadMore') }}
    </button>

    <div
      v-if="!loading && !items.length"
      class="flex flex-col items-center gap-2 rounded-[20px] bg-(--omb-surface) px-6 py-12 text-center shadow-(--omb-shadow)"
    >
      <span
        class="mb-1 flex size-10 items-center justify-center rounded-full bg-(--omb-chip) text-(--omb-text)"
      >
        <UIcon :name="hasFilters ? 'i-lucide-search-x' : 'i-lucide-book'" class="size-5" />
      </span>
      <h2 class="text-lg font-semibold">
        {{ t(hasFilters ? 'library.noResultsTitle' : 'library.emptyTitle') }}
      </h2>
      <p class="max-w-sm text-sm text-(--omb-text-muted)">
        {{ t(hasFilters ? 'library.noResultsBody' : 'library.emptyBody') }}
      </p>
      <UButton
        v-if="hasFilters"
        color="neutral"
        variant="outline"
        class="mt-2"
        @click="router.replace({ query: {} })"
      >
        {{ t('library.clear') }}
      </UButton>
    </div>
  </section>
</template>
