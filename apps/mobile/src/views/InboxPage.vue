<script setup lang="ts">
import {
  createGesture,
  IonContent,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
  type Gesture,
} from '@ionic/vue'
import { toLocal, type ItemDto, type ItemStatus } from '@omb/shared'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import ItemRow from '../components/ItemRow.vue'
import TriageCard from '../components/TriageCard.vue'
import { useLongPress } from '../composables/useLongPress'
import { remember, remind, setStatus } from '../lib/actions'
import { formatter } from '../lib/format'
import { openItemMenu } from '../lib/itemMenu'
import { readJson, writeJson } from '../lib/prefs'
import { pickReminder } from '../lib/remind'
import { loadInbox, store } from '../lib/store'

/** Mockups: Mobile · Inbox swipe triage, Inbox list view, Hold for more, Remind sheet. */
const { t, locale } = useI18n()
const router = useRouter()

const view = ref<'cards' | 'list'>('cards')
onMounted(async () => {
  view.value = (await readJson<'cards' | 'list'>('inbox.view')) ?? 'cards'
})
function toggleView() {
  view.value = view.value === 'cards' ? 'list' : 'cards'
  void writeJson('inbox.view', view.value)
}

onIonViewWillEnter(() => void loadInbox())

async function refresh(event: CustomEvent) {
  await loadInbox()
  ;(event.target as HTMLIonRefresherElement).complete()
}

// Swiping only flips through the cards; the buttons below decide what happens to one.
/** Which card is on top. */
const index = ref(0)
const triaged = ref(0)
const total = computed(() => store.inbox.length)
const position = computed(() => Math.min(index.value + 1, total.value))
const progress = computed(() => (total.value ? position.value / total.value : 0))
watch(
  () => store.inbox.length,
  (n) => {
    if (n === 0) triaged.value = 0
    if (index.value > Math.max(0, n - 1)) index.value = Math.max(0, n - 1)
  },
)

const current = computed<ItemDto | undefined>(() => store.inbox[index.value])
const next = computed<ItemDto | undefined>(
  () => store.inbox[index.value + 1] ?? store.inbox[index.value - 1],
)

async function triage(item: ItemDto, status: ItemStatus) {
  triaged.value += 1
  const saved = await setStatus(item, status)
  if (!saved) triaged.value = Math.max(0, triaged.value - 1)
}

/** +1 = next card, -1 = previous. Springs back at either end. */
function flip(step: 1 | -1) {
  const to = index.value + step
  if (to < 0 || to >= store.inbox.length) return false
  index.value = to
  return true
}

async function remindItem(item: ItemDto) {
  const choice = await pickReminder()
  if (choice) await remind(item, choice)
}

// ── Swipe gesture on the top card ──
const cardEl = ref<HTMLElement | null>(null)
const dx = ref(0)
const dragging = ref(false)
const flying = ref<0 | 1 | -1>(0)
let gesture: Gesture | null = null
/** When the last drag ended: the click that follows a drag must not open the item. */
let dragEndedAt = 0
const THRESHOLD = 110

function attach() {
  gesture?.destroy()
  gesture = null
  if (!cardEl.value) return
  gesture = createGesture({
    el: cardEl.value,
    gestureName: 'triage-swipe',
    // Above the pull-to-refresh gesture (31), which otherwise claims every touch on the page.
    gesturePriority: 40,
    threshold: 8,
    direction: 'x',
    onStart: () => {
      dragging.value = true
    },
    onMove: (d) => {
      dx.value = d.deltaX
    },
    onEnd: (d) => {
      dragging.value = false
      dragEndedAt = Date.now()
      // Left shows the next card, right goes back to the previous one.
      const direction = d.deltaX > 0 ? 1 : -1
      const step = direction > 0 ? -1 : 1
      const to = index.value + step
      if (Math.abs(d.deltaX) > THRESHOLD && to >= 0 && to < store.inbox.length) {
        flying.value = direction
        setTimeout(() => {
          flying.value = 0
          dx.value = 0
          flip(step)
        }, 180)
      } else dx.value = 0
    },
  })
  gesture.enable()
}
watch([cardEl, () => current.value?.id], () => void nextTick(attach))
onBeforeUnmount(() => gesture?.destroy())

const cardStyle = computed(() => {
  const x = flying.value ? flying.value * 520 : dx.value
  return {
    transform: `translateX(${x}px) rotate(${x / 16}deg)`,
    transition: dragging.value ? 'none' : 'transform 0.2s ease-out',
  }
})

const press = useLongPress(() => current.value && openItemMenu(current.value, router))

function openCurrent() {
  // A drag that sprang back still ends in a click; only a plain tap opens the item.
  if (current.value && Date.now() - dragEndedAt > 300) void router.push(`/item/${current.value.id}`)
}

/** Pager dots under the header; a long inbox gets a thin bar instead. */
const MAX_DOTS = 9

// ── List view ──
/** "Today", "Yesterday" or the date, shown once above each day's notes. */
function dayOf(iso: string) {
  const l = toLocal(new Date(iso), formatter.value.timeZone)
  return Date.UTC(l.year, l.month - 1, l.day) / 86_400_000
}
function dayLabel(iso: string) {
  const diff = dayOf(iso) - dayOf(new Date().toISOString())
  if (diff === 0) return t('reminder.today')
  if (diff === -1) return t('reminder.yesterday')
  return new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'long',
    timeZone: formatter.value.timeZone,
  }).format(new Date(iso))
}
const listDays = computed(() =>
  store.inbox.map((item, i) => {
    const prev = store.inbox[i - 1]
    return !prev || dayOf(prev.capturedAt) !== dayOf(item.capturedAt)
      ? dayLabel(item.capturedAt)
      : null
  }),
)

async function slide(item: ItemDto, status: ItemStatus, el: EventTarget | null) {
  await (el as HTMLElement | null)?.closest('ion-item-sliding')?.close()
  await setStatus(item, status)
}

const cachedNote = computed(() =>
  store.inboxCachedAt
    ? `${t('mobile.inbox.cached')} · ${formatter.value.relative(new Date(store.inboxCachedAt).toISOString())}`
    : null,
)
</script>

<template>
  <IonPage>
    <IonContent :scroll-y="view === 'list'">
      <IonRefresher slot="fixed" @ion-refresh="refresh">
        <IonRefresherContent />
      </IonRefresher>

      <div class="page" :class="`view-${view}`">
        <header class="omb-header">
          <h1>{{ t('mobile.tabs.inbox') }}</h1>
          <span v-if="store.inbox.length" class="meta">
            {{
              view === 'cards'
                ? t('mobile.inbox.position', { i: position, n: total })
                : t('mobile.inbox.waiting', { n: store.inbox.length })
            }}
          </span>
          <div class="grow" />
          <button type="button" class="toggle" @click="toggleView">
            {{ view === 'cards' ? t('mobile.inbox.listView') : t('mobile.inbox.cardView') }}
          </button>
        </header>
        <template v-if="view === 'cards' && store.inbox.length > 1">
          <div v-if="total <= MAX_DOTS" class="dots" aria-hidden="true">
            <span v-for="n in total" :key="n" :class="{ on: n - 1 === index }" />
          </div>
          <div v-else class="progress" aria-hidden="true">
            <div :style="{ width: `${progress * 100}%` }" />
          </div>
        </template>
        <p v-if="cachedNote" class="omb-banner">{{ cachedNote }}</p>

        <div v-if="store.inboxLoaded && !store.inbox.length" class="omb-empty">
          <span class="zero"><AppIcon name="check" :size="28" :stroke="2.2" /></span>
          <h2>{{ triaged ? t('inbox.zeroTitle') : t('inbox.emptyTitle') }}</h2>
          <p>{{ triaged ? t('inbox.zeroBody') : t('inbox.emptyBody') }}</p>
        </div>

        <!-- Cards -->
        <template v-else-if="view === 'cards' && current">
          <main class="stack">
            <div v-if="next" class="under" />
            <div
              :key="current.id"
              ref="cardEl"
              class="top"
              :style="cardStyle"
              v-bind="press"
              @click="openCurrent"
            >
              <TriageCard :item="current" />
            </div>
          </main>
          <div class="grow" />

          <div class="actions">
            <button type="button" class="act" @click="triage(current, 'ARCHIVED')">
              <span class="ring"><AppIcon name="archive" :size="22" /></span
              >{{ t('actions.archive') }}
            </button>
            <button type="button" class="act" @click="remindItem(current)">
              <span class="ring rem"><AppIcon name="clock" :size="22" /></span
              >{{ t('actions.remind') }}
            </button>
            <button type="button" class="act" @click="remember(current)">
              <span class="ring"><AppIcon name="repeat" :size="22" /></span>
              {{ t('actions.remember') }}
            </button>
            <button type="button" class="act" @click="triage(current, 'KEPT')">
              <span class="ring keep"><AppIcon name="check" :size="22" :stroke="2.2" /></span>
              {{ t('actions.keep') }}
            </button>
          </div>
          <p class="hint">{{ t('mobile.inbox.hint') }}</p>
        </template>

        <!-- List -->
        <template v-else-if="view === 'list'">
          <IonList class="list" lines="none">
            <template v-for="(item, i) in store.inbox" :key="item.id">
              <h2 v-if="listDays[i]" class="omb-section-label day">{{ listDays[i] }}</h2>
              <IonItemSliding>
                <IonItemOptions side="start" @ion-swipe="slide(item, 'KEPT', $event.target)">
                  <IonItemOption
                    class="opt keep"
                    expandable
                    @click="slide(item, 'KEPT', $event.target)"
                  >
                    <AppIcon name="check" :size="20" :stroke="2.2" />{{ t('actions.keep') }}
                  </IonItemOption>
                </IonItemOptions>
                <IonItem class="list-item">
                  <ItemRow
                    :item="item"
                    @open="router.push(`/item/${item.id}`)"
                    @hold="openItemMenu(item, router)"
                  />
                </IonItem>
                <IonItemOptions side="end" @ion-swipe="slide(item, 'ARCHIVED', $event.target)">
                  <IonItemOption
                    class="opt archive"
                    expandable
                    @click="slide(item, 'ARCHIVED', $event.target)"
                  >
                    <AppIcon name="archive" :size="20" />{{ t('actions.archive') }}
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            </template>
          </IonList>
          <p class="hint">{{ t('mobile.inbox.listHint') }}</p>
        </template>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.page.view-cards {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.omb-header {
  padding-bottom: 8px;
}
.toggle {
  flex: none;
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--omb-hover);
  font: 500 13px var(--ion-font-family);
  color: var(--omb-text);
}
.dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 6px 0 0;
}
.dots span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--omb-dot);
  transition:
    width 0.2s,
    background 0.2s;
}
.dots span.on {
  width: 18px;
  background: var(--omb-text);
}
.progress {
  margin: 8px 22px 0;
  height: 4px;
  border-radius: 999px;
  background: var(--omb-dot);
  overflow: hidden;
}
.progress div {
  height: 100%;
  border-radius: 999px;
  background: var(--omb-text);
  transition: width 0.25s;
}
.stack {
  position: relative;
  flex: 1 1 auto;
  min-height: 360px;
  max-height: 500px;
  margin: 22px 20px 26px;
}
.under {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 14px;
  bottom: -12px;
  background: var(--omb-hover);
  border-radius: 26px;
}
.top {
  position: absolute;
  inset: 0;
  transform-origin: bottom center;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.top :deep(.card) {
  box-shadow: var(--omb-shadow-lg);
}
.actions {
  display: flex;
  justify-content: space-around;
  padding: 0 18px 10px;
}
.act {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  border: 0;
  background: transparent;
  font: 500 12px var(--ion-font-family);
  color: var(--omb-text-toned);
}
.ring {
  width: 58px;
  height: 58px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--omb-surface);
  box-shadow:
    0 1px 2px rgba(17, 17, 17, 0.05),
    0 6px 18px rgba(17, 17, 17, 0.06);
  color: var(--omb-text);
}
.act:active .ring {
  transform: scale(0.96);
}
.ring.rem {
  color: var(--omb-rem);
}
.ring.keep {
  background: var(--omb-keep);
  color: var(--omb-on-keep);
}
.hint {
  margin: 0 0 12px;
  padding: 0 16px;
  text-align: center;
  font-size: 12.5px;
  color: var(--omb-text-muted);
}
.list {
  background: transparent;
  margin: 0;
  padding: 0 16px !important;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.day {
  margin: 0;
  padding: 8px 4px 2px;
}
.list + .hint {
  margin-top: 12px;
}
.list-item {
  --background: transparent;
  --padding-start: 0;
  --padding-end: 0;
  --inner-padding-start: 0;
  --inner-padding-end: 0;
  --min-height: 0;
  overflow: visible;
}
.list ion-item-sliding {
  border-radius: 18px;
}
.opt {
  font: 600 12.5px var(--ion-font-family);
  min-width: 104px;
}
.opt::part(native) {
  flex-direction: column;
  gap: 4px;
}
.opt.keep {
  --background: var(--omb-keep);
  --color: var(--omb-on-keep);
}
.opt.archive {
  --background: var(--omb-archive);
  --color: #ffffff;
}
.zero {
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: var(--omb-surface);
  box-shadow: var(--omb-shadow);
  color: var(--omb-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
