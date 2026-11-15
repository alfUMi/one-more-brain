<script setup lang="ts">
import { ITEM_KINDS, type ItemDto, type ItemKind } from '@omb/shared'
import type { KindCounts } from '~/composables/useItemsApi'
import { cacheGet, cachePut } from '~/lib/localDb'

const { t } = useI18n()
const toast = useToast()
useHead({ title: () => t('inbox.title') })

const api = useItemsApi()
const outbox = useOutbox()
const online = useOnline()
const { user } = useCurrentUser()
/** Showing the copy saved on this device because the server can't be reached. */
const fromCache = ref(false)
const items = ref<ItemDto[]>([])
const cursor = ref<string | null>(null)
const loading = ref(true)
const kind = ref<ItemKind | null>(null)
const counts = ref<KindCounts | null>(null)
const query = ref('')

const capture = useTemplateRef('capture')
const search = useTemplateRef('search')
const list = useTemplateRef('list')

const CACHE_KEY = 'inbox'

async function load(more = false) {
  loading.value = true
  try {
    const page = await api.list({
      status: 'INBOX',
      kind: kind.value ?? undefined,
      cursor: more ? (cursor.value ?? undefined) : undefined,
    })
    items.value = more ? [...items.value, ...page.items] : page.items
    cursor.value = page.nextCursor
    fromCache.value = false
    if (!more && !kind.value && user.value) void cachePut(user.value.id, CACHE_KEY, page.items)
  } catch (error) {
    // Offline (no HTTP status): show the last copy saved on this device.
    if ((error as { statusCode?: number }).statusCode || more || !user.value) throw error
    const cached = (await cacheGet<ItemDto[]>(user.value.id, CACHE_KEY)) ?? []
    items.value = kind.value ? cached.filter((i) => i.kind === kind.value) : cached
    cursor.value = null
    fromCache.value = true
  } finally {
    loading.value = false
  }
  if (!more) await mergePending()
  if (!more) nextTick(() => list.value?.selectFirst())
}

/** Captures still waiting in the outbox go on top, so nothing typed offline disappears. */
async function mergePending() {
  const known = new Set(items.value.map((i) => i.id))
  const waiting = (await outbox.pending())
    .filter((e) => !known.has(e.id))
    .map((e) =>
      localItem(
        e.input,
        e.files.map((f) => URL.createObjectURL(f.blob)),
      ),
    )
    .filter((i) => !kind.value || i.kind === kind.value)
    .reverse()
  items.value = [...waiting, ...items.value]
}

const sidebar = useSidebar()
async function refreshCounts() {
  counts.value = await api.counts('INBOX').catch(() => counts.value)
  void sidebar.refresh()
}

watch(kind, () => load())
onMounted(() => {
  void load()
  void refreshCounts()
})

const filters = computed(() =>
  (['ALL', ...ITEM_KINDS] as const)
    .map((k) => ({ kind: k, count: counts.value?.[k] ?? 0 }))
    .filter((f) => f.kind === 'ALL' || f.count > 0),
)

function onOptimistic(item: ItemDto) {
  if (!kind.value || kind.value === item.kind) items.value.unshift(item)
}
function onSaved(item: ItemDto) {
  const i = items.value.findIndex((x) => x.id === item.id)
  if (i !== -1) {
    // Local previews (object URLs) are no longer needed once the server copy is here.
    for (const a of items.value[i]!.attachments) {
      if (a.url.startsWith('blob:')) URL.revokeObjectURL(a.url)
    }
    items.value.splice(i, 1, item)
  }
  void refreshCounts()
  if (item.aiStatus === 'PENDING') void awaitAi(item.id)
}

outbox.on((event) => {
  if (event.type === 'synced') onSaved(event.item)
  if (event.type === 'rejected') {
    onFailed(event.entry.id)
    toast.add({
      title: t('offline.rejected'),
      description: event.entry.input.body?.slice(0, 120) ?? event.error,
      color: 'error',
    })
  }
})
// Back online: replace the cached copy with fresh data.
watch(online, (on) => on && fromCache.value && void load())

/** The AI pass takes a few seconds; refresh the card once it lands (gives up after ~20 s). */
async function awaitAi(id: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2500))
    const fresh = await api.get(id).catch(() => null)
    if (!fresh || fresh.aiStatus === 'PENDING') continue
    const i = items.value.findIndex((x) => x.id === id)
    if (i !== -1) items.value.splice(i, 1, fresh)
    void refreshCounts()
    return
  }
}
function onFailed(id: string) {
  items.value = items.value.filter((x) => x.id !== id)
}

function submitSearch() {
  if (query.value.trim()) void navigateTo({ path: '/library', query: { q: query.value.trim() } })
}

function onKeydown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable="true"]')) return
  if (e.key === 'c') {
    e.preventDefault()
    capture.value?.focus()
  } else if (e.key === '/') {
    e.preventDefault()
    search.value?.inputRef?.focus()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="flex max-w-[820px] flex-col gap-[18px]">
    <header class="flex flex-wrap items-center gap-4">
      <div class="flex items-baseline gap-3">
        <h1 class="text-[30px] font-bold">{{ t('inbox.title') }}</h1>
        <span v-if="counts?.ALL" class="text-sm text-(--omb-text-muted)">
          {{ t('inbox.toTriage', { n: counts.ALL }) }}
        </span>
      </div>
      <div class="flex-1" />
      <form class="w-full sm:w-auto sm:min-w-60" role="search" @submit.prevent="submitSearch">
        <UInput
          ref="search"
          v-model="query"
          type="search"
          icon="i-lucide-search"
          :placeholder="t('inbox.searchPlaceholder')"
          :aria-label="t('inbox.search')"
          class="w-full"
          size="lg"
          @keydown.esc="($event.target as HTMLInputElement).blur()"
        >
          <template #trailing><span class="omb-kbd">/</span></template>
        </UInput>
      </form>
    </header>

    <div
      v-if="!online || fromCache"
      role="status"
      class="flex items-center gap-3 rounded-[14px] border border-(--omb-border) bg-(--omb-surface) px-4 py-3 text-sm"
    >
      <UIcon name="i-lucide-cloud-off" class="size-[18px] flex-none text-(--omb-text-muted)" />
      <span>{{ t('offline.banner') }}</span>
    </div>

    <PushPrompt v-else />

    <CaptureBox ref="capture" @optimistic="onOptimistic" @saved="onSaved" @failed="onFailed" />

    <div
      v-if="counts?.ALL"
      role="group"
      :aria-label="t('inbox.filterByKind')"
      class="flex flex-wrap gap-1"
    >
      <button
        v-for="f in filters"
        :key="f.kind"
        type="button"
        :aria-pressed="(kind ?? 'ALL') === f.kind"
        :class="[
          'h-8 rounded-lg border px-3 text-[13px] font-medium',
          (kind ?? 'ALL') === f.kind
            ? 'border-(--omb-border) bg-(--omb-surface) text-(--omb-text)'
            : 'border-transparent text-(--omb-text-muted) hover:bg-(--omb-hover)',
        ]"
        @click="kind = f.kind === 'ALL' ? null : f.kind"
      >
        {{ t(`kinds.${f.kind}`) }} {{ f.count }}
      </button>
    </div>

    <ItemList
      v-if="items.length"
      ref="list"
      v-model="items"
      triage
      :keeps-item="(i) => i.status === 'INBOX'"
      @change="refreshCounts"
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
        <UIcon :name="counts?.ALL === 0 ? 'i-lucide-inbox' : 'i-lucide-check'" class="size-5" />
      </span>
      <h2 class="text-lg font-semibold">
        {{ t(kind || counts?.ALL ? 'inbox.zeroTitle' : 'inbox.emptyTitle') }}
      </h2>
      <p class="max-w-sm text-sm text-(--omb-text-muted)">
        {{ t(kind || counts?.ALL ? 'inbox.zeroBody' : 'inbox.emptyBody') }}
      </p>
    </div>

    <footer
      v-if="items.length"
      class="hidden flex-wrap items-center gap-3.5 text-[12.5px] text-(--omb-text-muted) md:flex"
    >
      <span
        ><span class="omb-kbd">↑</span> <span class="omb-kbd">↓</span>
        {{ t('inbox.hints.move') }}</span
      >
      <span><span class="omb-kbd">E</span> {{ t('inbox.hints.edit') }}</span>
      <span><span class="omb-kbd">#</span> {{ t('inbox.hints.tag') }}</span>
      <span><span class="omb-kbd">C</span> {{ t('inbox.hints.capture') }}</span>
      <span class="flex-1" />
      <span>{{ t('inbox.hints.ai') }}</span>
    </footer>
  </section>
</template>
