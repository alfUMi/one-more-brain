<script setup lang="ts">
import {
  actionSheetController,
  IonContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
} from '@ionic/vue'
import { ITEM_KINDS, type ItemDto, type ItemKind, type ItemStatus } from '@omb/shared'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import ItemRow from '../components/ItemRow.vue'
import { formatter } from '../lib/format'
import { openItemMenu } from '../lib/itemMenu'
import { cacheGet, cachePut } from '../lib/prefs'
import { api, session } from '../lib/session'
import { loadTags, store } from '../lib/store'

/** Mockup: Mobile · Library. */
const { t } = useI18n()
const router = useRouter()

const q = ref('')
const status = ref<ItemStatus | 'ALL'>('ALL')
const kind = ref<ItemKind | null>(null)
const tag = ref<string | null>(null)

const items = ref<ItemDto[]>([])
const cursor = ref<string | null>(null)
const loading = ref(false)
const loaded = ref(false)
const cachedAt = ref<number | null>(null)
const fetchedAt = ref<number | null>(null)

const STATUSES = ['ALL', 'KEPT', 'ARCHIVED', 'DONE'] as const

const query = computed(() => ({
  q: q.value.trim() || undefined,
  status: status.value === 'ALL' ? undefined : status.value,
  kind: kind.value ?? undefined,
  tag: tag.value ?? undefined,
}))
const cacheKey = computed(() => `library:${JSON.stringify(query.value)}`)

let seq = 0
async function load(reset = true) {
  const mine = ++seq
  loading.value = true
  try {
    const page = await api.list({
      ...query.value,
      cursor: reset ? undefined : (cursor.value ?? undefined),
      limit: 30,
    })
    if (mine !== seq) return
    items.value = reset ? page.items : [...items.value, ...page.items]
    cursor.value = page.nextCursor
    cachedAt.value = null
    fetchedAt.value = Date.now()
    if (reset && session.profile) void cachePut(session.profile.id, cacheKey.value, page.items)
  } catch {
    if (mine !== seq || !reset || !session.profile) return
    const cached = await cacheGet<ItemDto[]>(session.profile.id, cacheKey.value)
    items.value = cached?.data ?? []
    cursor.value = null
    cachedAt.value = cached?.savedAt ?? Date.now()
  } finally {
    if (mine === seq) {
      loading.value = false
      loaded.value = true
    }
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
watch(q, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void load(), 300)
})
watch([status, kind, tag], () => void load())

onIonViewWillEnter(() => {
  void load()
  void loadTags()
})

async function refresh(event: CustomEvent) {
  await Promise.all([load(), loadTags()])
  ;(event.target as HTMLIonRefresherElement).complete()
}

async function more(event: CustomEvent) {
  if (cursor.value) await load(false)
  ;(event.target as HTMLIonInfiniteScrollElement).complete()
}

async function pickKind() {
  const sheet = await actionSheetController.create({
    header: t('mobile.library.kind'),
    buttons: [
      { text: t('kinds.ALL'), data: 'ALL' },
      ...ITEM_KINDS.map((k) => ({ text: t(`kinds.${k}`), data: k })),
      { text: t('actions.cancel'), role: 'cancel' },
    ],
  })
  await sheet.present()
  const { data } = await sheet.onDidDismiss<ItemKind | 'ALL'>()
  if (data) kind.value = data === 'ALL' ? null : data
}

function toggleTag(name: string) {
  tag.value = tag.value === name ? null : name
}

const statusLine = computed(() => {
  if (cachedAt.value) return t('mobile.library.offline')
  if (!fetchedAt.value) return ''
  return t('mobile.library.synced', {
    when: formatter.value.relative(new Date(fetchedAt.value).toISOString()),
  })
})
</script>

<template>
  <IonPage>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="refresh">
        <IonRefresherContent />
      </IonRefresher>

      <header class="omb-header">
        <h1>{{ t('library.title') }}</h1>
        <div class="grow" />
        <span class="synced">{{ statusLine }}</span>
      </header>

      <div class="filters">
        <label class="search">
          <AppIcon name="search" :size="18" :stroke="1.9" />
          <span class="sr-only">{{ t('mobile.library.searchLabel') }}</span>
          <input
            v-model="q"
            type="search"
            enterkeyhint="search"
            :placeholder="t('library.searchPlaceholder')"
          />
          <button
            v-if="q"
            type="button"
            class="clear"
            :aria-label="t('library.clear')"
            @click="q = ''"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </label>
        <div class="omb-segment" role="group" :aria-label="t('library.filterByStatus')">
          <button
            v-for="s in STATUSES"
            :key="s"
            type="button"
            :aria-pressed="status === s"
            @click="status = s"
          >
            {{ t(`statuses.${s}`) }}
          </button>
        </div>
        <div class="pills">
          <button type="button" class="pill" :class="{ on: kind }" @click="pickKind">
            {{ kind ? t(`kinds.${kind}`) : t('mobile.library.kind') }}
            <AppIcon name="chevron-down" :size="14" :stroke="2" />
          </button>
          <button
            v-for="x in store.tags"
            :key="x.name"
            type="button"
            class="pill"
            :class="{ on: tag === x.name }"
            :aria-pressed="tag === x.name"
            @click="toggleTag(x.name)"
          >
            #{{ x.name }}
          </button>
        </div>
      </div>

      <main class="results">
        <span v-if="loaded && items.length" class="omb-meta">
          {{ t('library.results', { n: items.length }) }}{{ cursor ? '+' : '' }}
        </span>
        <div v-if="loaded && !loading && !items.length" class="omb-empty">
          <h2>
            {{
              query.q || query.tag || query.kind || query.status
                ? t('library.noResultsTitle')
                : t('library.emptyTitle')
            }}
          </h2>
          <p>
            {{
              query.q || query.tag || query.kind || query.status
                ? t('library.noResultsBody')
                : t('library.emptyBody')
            }}
          </p>
        </div>
        <ItemRow
          v-for="item in items"
          :key="item.id"
          :item="item"
          show-status
          @open="router.push(`/item/${item.id}`)"
          @hold="openItemMenu(item, router).then(() => load())"
        />
      </main>

      <IonInfiniteScroll :disabled="!cursor" @ion-infinite="more">
        <IonInfiniteScrollContent />
      </IonInfiniteScroll>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.synced {
  font-size: 12px;
  color: var(--omb-text-muted);
}
.filters {
  padding: 6px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.search {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 46px;
  padding: 0 14px;
  background: var(--omb-surface);
  border: 1px solid var(--omb-border);
  border-radius: 12px;
  color: var(--omb-text-muted);
}
.search input {
  flex-grow: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: 500 16px var(--ion-font-family);
  color: var(--omb-text);
}
.search input::-webkit-search-cancel-button {
  display: none;
}
.clear {
  display: flex;
  border: 0;
  background: transparent;
  color: var(--omb-text-muted);
  padding: 4px;
}
.pills {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin: 0 -16px;
  padding: 0 16px;
  scrollbar-width: none;
}
.pills::-webkit-scrollbar {
  display: none;
}
.pill {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--omb-border);
  border-radius: 999px;
  background: var(--omb-surface);
  font: 500 13px var(--ion-font-family);
  color: var(--omb-text-toned);
}
.pill.on {
  background: var(--omb-accent-soft);
  border-color: var(--omb-accent);
  color: var(--omb-accent);
  font-weight: 600;
}
.results {
  padding: 12px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
