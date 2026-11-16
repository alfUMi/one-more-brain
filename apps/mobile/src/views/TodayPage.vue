<script setup lang="ts">
import {
  actionSheetController,
  IonContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
} from '@ionic/vue'
import type { SnoozePreset, TodayEntry } from '@omb/shared'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { reminderDone, snooze } from '../lib/actions'
import { formatter, itemTitle } from '../lib/format'
import { loadToday, store } from '../lib/store'

/** Mockup: Mobile · Today. */
const { t, locale } = useI18n()
const router = useRouter()

onIonViewWillEnter(() => void loadToday())

async function refresh(event: CustomEvent) {
  await loadToday()
  ;(event.target as HTMLIonRefresherElement).complete()
}

// "In 25 minutes" and which reminder is next move with the clock.
const now = ref(Date.now())
const ticker = setInterval(() => (now.value = Date.now()), 30_000)
onBeforeUnmount(() => clearInterval(ticker))
watch(now, () => {
  const next = store.today?.reminders.find((r) => r.state === 'next')
  if (next?.reminder.fireAt && new Date(next.reminder.fireAt).getTime() <= now.value) {
    void loadToday()
  }
})

const today = computed(() => store.today)
const dateLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: formatter.value.timeZone,
  }).format(new Date(now.value)),
)
const left = computed(
  () => today.value?.reminders.filter((r) => r.state !== 'done' && r.state !== 'past').length ?? 0,
)

function inLabel(at: string | null) {
  if (!at) return ''
  const minutes = Math.max(1, Math.round((new Date(at).getTime() - now.value) / 60_000))
  const unit = (n: number, u: 'minute' | 'hour') =>
    new Intl.NumberFormat(locale.value, { style: 'unit', unit: u, unitDisplay: 'long' }).format(n)
  return t('today.in', {
    time: minutes < 60 ? unit(minutes, 'minute') : unit(Math.round(minutes / 60), 'hour'),
  })
}

const canAct = (e: TodayEntry) =>
  e.reminder.kind === 'TIME' && (e.state === 'next' || e.state === 'missed')

async function snoozeMenu(entry: TodayEntry) {
  const sheet = await actionSheetController.create({
    header: t('mobile.today.snoozeFor'),
    buttons: [
      { text: t('reminder.inHour'), data: '1h' },
      { text: t('reminder.evening'), data: 'tonight' },
      { text: t('reminder.tomorrow'), data: 'tomorrow' },
      { text: t('actions.cancel'), role: 'cancel' },
    ],
  })
  await sheet.present()
  const { data } = await sheet.onDidDismiss<SnoozePreset>()
  if (data) await snooze(entry.reminder.id, data)
}

const reviewMinutes = computed(() => Math.max(1, Math.round((today.value?.reviewsDue ?? 0) / 2)))
</script>

<template>
  <IonPage>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="refresh">
        <IonRefresherContent />
      </IonRefresher>

      <header class="omb-header baseline">
        <h1>{{ t('today.title') }}</h1>
        <span class="meta">{{ dateLabel }}</span>
      </header>
      <p v-if="store.todayCachedAt" class="omb-banner">{{ t('mobile.inbox.cached') }}</p>

      <main v-if="today" class="main">
        <section class="omb-panel" aria-labelledby="rem-h">
          <div class="panel-head">
            <h2 id="rem-h">{{ t('today.reminders') }}</h2>
            <span class="omb-meta">
              {{ left ? t('today.leftToday', { n: left }) : t('today.allDone') }}
            </span>
          </div>
          <p v-if="!today.reminders.length" class="omb-hint">{{ t('today.noReminders') }}</p>
          <div>
            <div
              v-for="entry in today.reminders"
              :key="entry.reminder.id"
              class="rem"
              :class="[entry.state, { act: canAct(entry) }]"
            >
              <button type="button" class="rem-main" @click="router.push(`/item/${entry.item.id}`)">
                <span class="time">
                  {{ entry.reminder.fireAt ? formatter.time(new Date(entry.reminder.fireAt)) : '' }}
                </span>
                <span class="rem-text">
                  <span class="what">{{ itemTitle(entry.item) }}</span>
                  <span v-if="entry.state === 'next'" class="omb-meta rem-color">
                    {{ inLabel(entry.reminder.fireAt) }}
                  </span>
                  <span v-else-if="entry.state === 'missed'" class="omb-meta rem-color">
                    {{ t('today.overdue', { when: formatter.when(entry.reminder.fireAt!) }) }}
                  </span>
                  <span v-else-if="entry.reminder.rrule && entry.state !== 'done'" class="omb-meta">
                    {{ formatter.recurrence(entry.reminder.rrule).replace(/, \d\d:\d\d$/, '') }}
                  </span>
                </span>
                <span v-if="entry.state === 'done'" class="omb-meta">{{ t('today.done') }}</span>
              </button>
              <div v-if="canAct(entry)" class="rem-actions">
                <button type="button" class="omb-btn omb-btn-sm" @click="snoozeMenu(entry)">
                  {{ t('today.snooze') }}
                </button>
                <button
                  type="button"
                  class="omb-btn omb-btn-sm omb-btn-dark"
                  @click="reminderDone(entry.reminder.id)"
                >
                  {{ t('today.done') }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <button
          v-if="today.reviewsDue"
          type="button"
          class="review-row"
          @click="router.push('/review')"
        >
          <span class="review-icon"><AppIcon name="repeat" :size="18" :stroke="1.9" /></span>
          <span class="review-text">
            <span class="strong">{{ t('mobile.today.toReview', { n: today.reviewsDue }) }}</span>
            <span class="omb-meta">{{ t('mobile.today.aboutMinutes', { n: reviewMinutes }) }}</span>
          </span>
          <span class="start">{{ t('mobile.today.start') }}</span>
        </button>

        <section class="omb-panel" aria-labelledby="otd-h">
          <h2 id="otd-h">{{ t('today.onThisDay') }}</h2>
          <p v-if="!today.onThisDay.length" class="omb-hint">{{ t('today.nothingOnThisDay') }}</p>
          <button
            v-for="(entry, i) in today.onThisDay"
            :key="entry.item.id"
            type="button"
            class="otd"
            :class="{ first: i === 0 }"
            @click="router.push(`/item/${entry.item.id}`)"
          >
            <span class="omb-meta">{{ t(`today.ago.${entry.ago}`) }}</span>
            <span class="otd-text">{{ itemTitle(entry.item) }}</span>
          </button>
        </section>

        <section class="inbox-panel" aria-labelledby="inb-h">
          <div class="inbox-text">
            <h2 id="inb-h">
              {{
                today.inbox.count
                  ? t('today.inboxWaiting', { n: today.inbox.count })
                  : t('inbox.zeroTitle')
              }}
            </h2>
            <span class="sub">
              {{
                today.inbox.oldestCapturedAt
                  ? t('mobile.today.oldest', {
                      when: formatter.relative(today.inbox.oldestCapturedAt),
                    })
                  : t('today.inboxZero')
              }}
            </span>
          </div>
          <button
            v-if="today.inbox.count"
            type="button"
            class="triage"
            @click="router.push('/tabs/inbox')"
          >
            {{ t('mobile.today.triage') }}
          </button>
        </section>
      </main>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.baseline {
  align-items: baseline;
  flex-wrap: wrap;
}
.main {
  padding: 8px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.rem {
  border-top: 1px solid var(--omb-border-muted);
}
.rem.done,
.rem.past {
  opacity: 0.55;
}
.rem.next {
  background: var(--omb-rem-row);
  margin: 0 -16px;
  padding: 0 16px;
}
.rem-main {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border: 0;
  background: transparent;
  text-align: left;
  color: var(--omb-text);
  font: inherit;
}
.rem.act .rem-main {
  padding-bottom: 6px;
}
.time {
  flex: none;
  width: 46px;
  font-size: 14px;
  font-weight: 600;
  color: var(--omb-rem-text);
  font-variant-numeric: tabular-nums;
  padding-top: 1px;
}
.rem.done .time,
.rem.past .time {
  color: var(--omb-text-muted);
}
.rem-text {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.what {
  font-size: 15px;
  overflow-wrap: anywhere;
}
.rem.done .what {
  text-decoration: line-through;
}
.rem.next .what {
  font-weight: 500;
}
.rem-color {
  color: var(--omb-rem-text);
}
.rem-actions {
  display: flex;
  gap: 8px;
  padding: 0 0 10px 58px;
}
.review-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 0 16px;
  background: var(--omb-surface);
  border: 2px solid var(--omb-accent);
  border-radius: 16px;
  color: var(--omb-text);
  text-align: left;
  font: inherit;
}
.review-icon {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--omb-accent-soft);
  color: var(--omb-accent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.review-text {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.strong {
  font-size: 15px;
  font-weight: 600;
}
.start {
  font-size: 14px;
  font-weight: 600;
  color: var(--omb-accent);
}
.otd {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 0 0;
  border: 0;
  border-top: 1px solid var(--omb-border-muted);
  background: transparent;
  text-align: left;
  color: var(--omb-text);
  font: inherit;
}
.otd.first {
  border-top: 0;
  padding-top: 0;
}
.otd-text {
  font-size: 15px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.inbox-panel {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--omb-inverse-bg);
  color: var(--omb-inverse-text);
}
.inbox-text {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.inbox-text h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.sub {
  font-size: 13px;
  color: var(--omb-inverse-muted);
}
.triage {
  height: 40px;
  padding: 0 14px;
  border: 0;
  border-radius: 10px;
  background: var(--omb-inverse-text);
  color: var(--omb-inverse-bg);
  font: 600 14px var(--ion-font-family);
}
</style>
