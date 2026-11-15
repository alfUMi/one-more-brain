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

const segment = (active: boolean) => [
  'h-8 rounded-lg border px-3 text-[13px] font-medium',
  active
    ? 'border-(--omb-border) bg-(--omb-surface) text-(--omb-text)'
    : 'border-transparent text-(--omb-text-muted) hover:bg-(--omb-hover)',
]
</script>

<template>
  <section class="flex flex-col gap-[18px]">
    <header class="flex items-baseline gap-3">
      <h1 class="text-[30px] font-bold">{{ t('library.title') }}</h1>
      <span v-if="filters.q && !loading" class="text-sm text-(--omb-text-muted)">
        {{ t('library.results', { n: items.length + (cursor ? '+' : '') }) }}
      </span>
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
        class="w-full"
        autofocus
        @keydown.esc="($event.target as HTMLInputElement).blur()"
      >
        <template #trailing><span class="omb-kbd">/</span></template>
      </UInput>
    </form>

    <div class="flex flex-col gap-2">
      <div role="group" :aria-label="t('library.filterByStatus')" class="flex flex-wrap gap-1">
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
      <div
        role="group"
        :aria-label="t('inbox.filterByKind')"
        class="flex flex-wrap items-center gap-1"
      >
        <button
          v-for="k in ['ALL', ...ITEM_KINDS] as const"
          :key="k"
          type="button"
          :aria-pressed="(filters.kind ?? 'ALL') === k"
          :class="segment((filters.kind ?? 'ALL') === k)"
          @click="setFilter({ kind: k === 'ALL' ? undefined : k })"
        >
          {{ t(`kinds.${k}`) }}
        </button>
        <span v-if="filters.tag" class="omb-chip omb-chip-tag ml-1 pr-1">
          #{{ filters.tag }}
          <button
            type="button"
            :aria-label="t('library.removeTag')"
            class="flex size-5 items-center justify-center rounded-full hover:bg-black/10"
            @click="setFilter({ tag: undefined })"
          >
            <UIcon name="i-lucide-x" class="size-3" />
          </button>
        </span>
      </div>
    </div>

    <ItemList
      v-if="items.length"
      v-model="items"
      :keeps-item="(i) => !filters.status || i.status === filters.status"
      @change="sidebar.refresh"
    />

    <UButton
      v-if="cursor"
      color="neutral"
      variant="outline"
      class="self-center"
      :loading="loading"
      @click="load(true)"
    >
      {{ t('inbox.loadMore') }}
    </UButton>

    <div
      v-if="!loading && !items.length"
      class="flex flex-col items-center gap-2 rounded-[14px] border border-(--omb-border) bg-(--omb-surface) px-6 py-12 text-center"
    >
      <span
        class="mb-1 flex size-10 items-center justify-center rounded-[10px] bg-(--omb-accent-soft) text-(--omb-accent)"
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
