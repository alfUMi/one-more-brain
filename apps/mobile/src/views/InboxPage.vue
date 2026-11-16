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
import type { ItemDto, ItemStatus } from '@omb/shared'
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
const { t } = useI18n()
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

// "3 of 7": how far this triage session got.
const triaged = ref(0)
const total = computed(() => triaged.value + store.inbox.length)
const position = computed(() => Math.min(triaged.value + 1, total.value))
const progress = computed(() => (total.value ? triaged.value / total.value : 0))
watch(
  () => store.inbox.length,
  (n) => n === 0 && (triaged.value = 0),
)

const current = computed<ItemDto | undefined>(() => store.inbox[0])
const next = computed<ItemDto | undefined>(() => store.inbox[1])

async function triage(item: ItemDto, status: ItemStatus) {
  triaged.value += 1
  const saved = await setStatus(item, status)
  if (!saved) triaged.value = Math.max(0, triaged.value - 1)
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
const THRESHOLD = 110

function attach() {
  gesture?.destroy()
  gesture = null
  if (!cardEl.value) return
  gesture = createGesture({
    el: cardEl.value,
    gestureName: 'triage-swipe',
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
      const item = current.value
      if (item && Math.abs(d.deltaX) > THRESHOLD) {
        const direction = d.deltaX > 0 ? 1 : -1
        flying.value = direction
        setTimeout(() => {
          flying.value = 0
          dx.value = 0
          void triage(item, direction > 0 ? 'KEPT' : 'ARCHIVED')
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
const reveal = computed(() => (dx.value > 0 || flying.value > 0 ? 'keep' : 'archive'))

const press = useLongPress(() => current.value && openItemMenu(current.value, router))

function openCurrent() {
  if (current.value && Math.abs(dx.value) < 4) void router.push(`/item/${current.value.id}`)
}

// ── List view ──
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
          <button type="button" class="omb-btn omb-btn-sm toggle" @click="toggleView">
            {{ view === 'cards' ? t('mobile.inbox.listView') : t('mobile.inbox.cardView') }}
          </button>
        </header>
        <div v-if="view === 'cards' && store.inbox.length" class="progress" aria-hidden="true">
          <div :style="{ width: `${progress * 100}%` }" />
        </div>
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
              class="reveal"
              :class="reveal"
              :style="{ opacity: Math.min(1, Math.abs(dx) / 80) || (flying ? 1 : 0) }"
            >
              <span>
                <AppIcon :name="reveal === 'keep' ? 'check' : 'archive'" :size="30" :stroke="2.4" />
                {{ reveal === 'keep' ? t('actions.keep') : t('actions.archive') }}
              </span>
            </div>
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
              <span class="ring accent"><AppIcon name="repeat" :size="22" /></span>
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
            <IonItemSliding v-for="item in store.inbox" :key="item.id">
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
.toggle {
  border-color: var(--omb-border);
}
.progress {
  margin: 4px 20px 0;
  height: 4px;
  border-radius: 2px;
  background: var(--omb-border);
  overflow: hidden;
}
.progress div {
  height: 100%;
  background: var(--omb-accent);
  transition: width 0.25s;
}
.stack {
  position: relative;
  flex: 1 1 auto;
  min-height: 360px;
  max-height: 470px;
  margin: 26px 20px 18px;
}
.under {
  position: absolute;
  left: 14px;
  right: 14px;
  top: 16px;
  bottom: -16px;
  background: var(--omb-surface);
  border: 1px solid var(--omb-border-muted);
  border-radius: 22px;
}
.reveal {
  position: absolute;
  inset: 0;
  border-radius: 22px;
  display: flex;
  align-items: center;
  padding: 0 26px;
  color: #ffffff;
  font-weight: 700;
  font-size: 14px;
}
.reveal span {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.reveal.keep {
  background: var(--omb-keep);
  color: var(--omb-on-keep);
}
.reveal.archive {
  background: var(--omb-archive);
  justify-content: flex-end;
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
  box-shadow: 0 18px 40px rgba(21, 23, 28, 0.16);
}
.actions {
  display: flex;
  justify-content: space-around;
  padding: 0 20px 10px;
}
.act {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  font: 600 12px var(--ion-font-family);
  color: var(--omb-text-toned);
}
.ring {
  width: 56px;
  height: 56px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--omb-surface);
  border: 1px solid var(--omb-border);
  color: var(--omb-text);
}
.ring.rem {
  color: var(--omb-rem-text);
}
.ring.accent {
  color: var(--omb-accent);
}
.ring.keep {
  background: var(--omb-keep);
  border-color: var(--omb-keep);
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
  padding: 10px 16px 0 !important;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list + .hint {
  margin-top: 10px;
}
.list-item {
  --background: transparent;
  --padding-start: 0;
  --padding-end: 0;
  --inner-padding-start: 0;
  --inner-padding-end: 0;
  --min-height: 0;
}
.list ion-item-sliding {
  border-radius: 14px;
}
.opt {
  font: 700 12px var(--ion-font-family);
  min-width: 96px;
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
  border-radius: 18px;
  background: var(--omb-accent-soft);
  color: var(--omb-accent);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
