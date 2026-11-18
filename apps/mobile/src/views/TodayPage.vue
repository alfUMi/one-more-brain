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
import { reminderDone, snooze } from '../lib/actions'
import { displayTitle, formatter, itemTitle, titleIsQuote } from '../lib/format'
import { loadToday, store } from '../lib/store'

/** Mockup: Mobile · Today. */
const { t, locale } = useI18n()
const router = useRouter()

const loading = ref(false)
async function load() {
  loading.value = true
  try {
    await loadToday()
  } finally {
    loading.value = false
  }
}
onIonViewWillEnter(() => void load())

async function refresh(event: CustomEvent) {
  await load()
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

const captured = computed(() => today.value?.captured ?? [])
const upcoming = computed(() => today.value?.upcoming ?? [])
const remembering = computed(() => today.value?.remembering ?? [])
const isDue = (at: string) => new Date(at).getTime() <= now.value

/** The "Now" line sits before the first reminder still ahead today. */
const nowAt = computed(() => {
  const list = today.value?.reminders ?? []
  const i = list.findIndex((e) => e.state === 'next' || e.state === 'later')
  return i === -1 ? list.length : i
})
const subtitle = computed(() => {
  if (!today.value?.reminders.length) return dateLabel.value
  return `${dateLabel.value} · ${left.value ? t('mobile.today.left', { n: left.value }) : t('today.allDone')}`
})
/** "Thu" for the Coming up rail. */
function weekday(at: string) {
  const name = new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    timeZone: formatter.value.timeZone,
  }).format(new Date(at))
  return name.charAt(0).toUpperCase() + name.slice(1)
}
const hasReminder = (item: { reminders: { status: string }[] }) =>
  item.reminders.some((r) => r.status === 'ACTIVE' || r.status === 'FIRED')

const reviewMinutes = computed(() => Math.max(1, Math.round((today.value?.reviewsDue ?? 0) / 2)))
</script>

<template>
  <IonPage>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="refresh">
        <IonRefresherContent />
      </IonRefresher>

      <div class="page">
        <header class="head">
          <h1>{{ t('today.title') }}</h1>
          <span class="sub">{{ subtitle }}</span>
        </header>
        <p v-if="store.todayCachedAt" class="omb-banner">{{ t('mobile.inbox.cached') }}</p>

        <div v-if="!today && !loading" class="omb-empty" role="alert">
          <h2>{{ t('today.loadFailed') }}</h2>
          <button type="button" class="omb-btn" @click="load">{{ t('today.retry') }}</button>
        </div>

        <main v-if="today" class="main">
          <!-- Today's reminders on a time rail, with a "Now" line between past and ahead. -->
          <section :aria-label="t('today.reminders')">
            <p v-if="!today.reminders.length" class="omb-hint indent">
              {{ t('today.noReminders') }}
            </p>
            <template v-for="(entry, i) in today.reminders" :key="entry.reminder.id">
              <div v-if="i === nowAt" class="ev now" aria-hidden="true">
                <span class="time">{{ t('mobile.today.now') }}</span>
                <span class="rail"><span class="node" /></span>
                <span class="now-line"><span /></span>
              </div>
              <div class="ev" :class="[entry.state, { act: canAct(entry) }]">
                <span class="time">
                  {{ entry.reminder.fireAt ? formatter.time(new Date(entry.reminder.fireAt)) : '' }}
                </span>
                <span class="rail"><span class="node" /></span>
                <div v-if="canAct(entry)" class="rem-card">
                  <button
                    type="button"
                    class="rem-main"
                    @click="router.push(`/item/${entry.item.id}`)"
                  >
                    <span class="rem-what">{{ itemTitle(entry.item) }}</span>
                    <span v-if="entry.state === 'next'" class="omb-meta rem-color">
                      {{ inLabel(entry.reminder.fireAt) }}
                    </span>
                    <span v-else class="omb-meta rem-color">
                      {{ t('today.overdue', { when: formatter.when(entry.reminder.fireAt!) }) }}
                    </span>
                  </button>
                  <span class="rem-actions">
                    <button type="button" class="omb-btn" @click="snoozeMenu(entry)">
                      {{ t('today.snooze') }}
                    </button>
                    <button
                      type="button"
                      class="omb-btn omb-btn-primary"
                      @click="reminderDone(entry.reminder.id)"
                    >
                      {{ t('today.done') }}
                    </button>
                  </span>
                </div>
                <button
                  v-else
                  type="button"
                  class="item"
                  @click="router.push(`/item/${entry.item.id}`)"
                >
                  <span class="what">{{ itemTitle(entry.item) }}</span>
                  <span v-if="entry.state === 'done'" class="omb-meta">{{ t('today.done') }}</span>
                  <span v-else-if="entry.reminder.rrule" class="omb-meta">
                    {{ formatter.recurrence(entry.reminder.rrule).replace(/, \d\d:\d\d$/, '') }}
                  </span>
                </button>
              </div>
            </template>
            <div
              v-if="today.reminders.length && nowAt === today.reminders.length"
              class="ev now"
              aria-hidden="true"
            >
              <span class="time">{{ t('mobile.today.now') }}</span>
              <span class="rail"><span class="node" /></span>
              <span class="now-line"><span /></span>
            </div>
          </section>

          <section aria-labelledby="cap-h">
            <h2 id="cap-h" class="omb-section-label label">
              {{ t('today.captured') }}
              <span v-if="captured.length" class="count">
                {{ t('today.capturedCount', { n: captured.length }) }}
              </span>
            </h2>
            <p v-if="!captured.length" class="omb-hint indent">{{ t('today.nothingCaptured') }}</p>
            <div v-for="item in captured" :key="item.id" class="ev captured">
              <span class="time">{{ formatter.time(new Date(item.capturedAt)) }}</span>
              <span class="rail"><span class="node" /></span>
              <button type="button" class="item" @click="router.push(`/item/${item.id}`)">
                <span class="what" :class="{ 'omb-quote': titleIsQuote(item) }">
                  {{ displayTitle(item) }}
                </span>
                <span v-if="hasReminder(item)" class="omb-rem-dot" />
                <span v-if="item.status !== 'INBOX'" class="omb-meta">
                  {{ t(`statuses.${item.status}`) }}
                </span>
              </button>
            </div>
          </section>

          <section v-if="upcoming.length" aria-labelledby="up-h">
            <h2 id="up-h" class="omb-section-label label">{{ t('today.upcoming') }}</h2>
            <div v-for="entry in upcoming" :key="entry.reminder.id" class="ev upcoming">
              <span class="time">
                {{ entry.reminder.fireAt ? weekday(entry.reminder.fireAt) : '' }}
              </span>
              <span class="rail"><span class="node" /></span>
              <button type="button" class="item" @click="router.push(`/item/${entry.item.id}`)">
                <span class="what">{{ itemTitle(entry.item) }}</span>
                <span class="omb-meta">
                  {{ entry.reminder.fireAt ? formatter.time(new Date(entry.reminder.fireAt)) : '' }}
                </span>
              </button>
            </div>
          </section>

          <section aria-labelledby="mem-h">
            <h2 id="mem-h" class="omb-section-label label">
              {{ t('today.remember') }}
              <span v-if="remembering.length" class="count">
                {{ t('today.remembering', { n: remembering.length }) }}
              </span>
            </h2>
            <p v-if="!remembering.length" class="omb-hint indent">
              {{ t('today.nothingRemembered') }}
            </p>
            <button
              v-for="card in remembering.slice(0, 6)"
              :key="card.item.id"
              type="button"
              class="item indent stacked"
              @click="router.push(`/item/${card.item.id}`)"
            >
              <span class="what" :class="{ 'omb-quote': titleIsQuote(card.item) }">
                {{ displayTitle(card.item) }}
              </span>
              <span class="omb-meta" :class="{ 'accent-color': isDue(card.nextAt) }">
                {{
                  isDue(card.nextAt)
                    ? t('today.dueNow')
                    : t('today.nextReview', { when: formatter.when(card.nextAt) })
                }}
              </span>
            </button>
          </section>

          <section aria-labelledby="otd-h">
            <h2 id="otd-h" class="omb-section-label label">{{ t('today.onThisDay') }}</h2>
            <p v-if="!today.onThisDay.length" class="omb-hint indent">
              {{ t('today.nothingOnThisDay') }}
            </p>
            <button
              v-for="entry in today.onThisDay"
              :key="entry.item.id"
              type="button"
              class="item indent stacked"
              @click="router.push(`/item/${entry.item.id}`)"
            >
              <span class="omb-meta">{{ t(`today.ago.${entry.ago}`) }}</span>
              <span class="what" :class="{ 'omb-quote': titleIsQuote(entry.item) }">
                {{ displayTitle(entry.item) }}
              </span>
            </button>
          </section>

          <section class="pill-card inbox" aria-labelledby="inb-h">
            <span class="pill-text">
              <h2 id="inb-h">
                {{
                  today.inbox.count
                    ? t('today.inboxWaiting', { n: today.inbox.count })
                    : t('inbox.zeroTitle')
                }}
              </h2>
              <span class="omb-meta">
                {{
                  today.inbox.oldestCapturedAt
                    ? t('mobile.today.oldest', {
                        when: formatter.relative(today.inbox.oldestCapturedAt),
                      })
                    : t('today.inboxZero')
                }}
              </span>
            </span>
            <button
              v-if="today.inbox.count"
              type="button"
              class="omb-btn pill-btn"
              @click="router.push('/tabs/inbox')"
            >
              {{ t('mobile.today.triage') }}
            </button>
          </section>
        </main>

        <div class="grow" />

        <button
          v-if="today?.reviewsDue"
          type="button"
          class="pill-card review"
          @click="router.push('/tabs/review')"
        >
          <span class="pill-text">
            <span class="strong">{{ t('mobile.today.toReview', { n: today.reviewsDue }) }}</span>
            <span class="omb-meta">{{ t('mobile.today.aboutMinutes', { n: reviewMinutes }) }}</span>
          </span>
          <span class="omb-btn omb-btn-primary pill-btn">{{ t('review.title') }}</span>
        </button>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
.head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: calc(var(--ion-safe-area-top, 0px) + 18px) 22px 14px;
}
.head h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.025em;
}
.sub {
  font-size: 14.5px;
  color: var(--omb-text-muted);
}
.main {
  padding: 0 16px 16px 10px;
}

/* One row of the day: time · rail with a node · what. */
.ev {
  display: grid;
  grid-template-columns: 44px 16px minmax(0, 1fr);
  column-gap: 10px;
}
.time {
  padding-top: 13px;
  font-size: 13px;
  font-weight: 500;
  color: var(--omb-text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.rail {
  position: relative;
  display: flex;
  justify-content: center;
}
.rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--omb-border);
}
.node {
  position: relative;
  box-sizing: border-box;
  margin-top: 17px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--omb-bg);
  border: 1.5px solid var(--omb-node);
}
.item {
  margin: 2px 0;
  padding: 10px 12px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  color: var(--omb-text);
  font: inherit;
}
.item:active {
  background: var(--omb-hover);
}
.item.stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}
.what {
  flex-grow: 1;
  min-width: 0;
  font-size: 15px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.item .omb-meta {
  flex: none;
}
.item.stacked .omb-meta {
  flex: initial;
}

/* Reminder states on the rail. */
.ev.done,
.ev.past {
  opacity: 0.5;
}
.ev.done .node,
.ev.past .node {
  background: var(--omb-node);
}
.ev.done .what {
  text-decoration: line-through;
}
.ev.next .node,
.ev.missed .node,
.ev.later .node,
.ev.upcoming .node {
  border-color: var(--omb-rem);
}
.ev.act .node {
  background: var(--omb-rem);
}
.ev.act .time {
  color: var(--omb-text);
  font-weight: 600;
}
.ev.now .time {
  color: var(--omb-rem-text);
  font-weight: 600;
}
.ev.now .node {
  margin-top: 19px;
  width: 6px;
  height: 6px;
  border: 0;
  background: var(--omb-rem);
}
.now-line {
  display: flex;
  align-items: center;
  padding: 13px 0 4px;
}
.now-line span {
  flex-grow: 1;
  height: 1px;
  background: var(--omb-rem);
  opacity: 0.45;
}
.rem-card {
  margin: 2px 0;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--omb-surface);
  box-shadow: var(--omb-shadow);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rem-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  color: var(--omb-text);
  font: inherit;
}
.rem-what {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.rem-color {
  color: var(--omb-rem-text);
}
.rem-actions {
  display: flex;
  gap: 8px;
}
.rem-actions .omb-btn {
  min-height: 44px;
  font-size: 14px;
}

/* Section labels line up with the text column. */
.label {
  margin: 0;
  padding: 20px 0 6px 70px;
}
.count {
  font-weight: 400;
}
.indent {
  margin-left: 70px;
}
p.indent {
  padding: 6px 0 2px;
}
.accent-color {
  color: var(--omb-accent);
}

/* Inbox and Review: pill cards at the end of the day. */
.pill-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px 12px 18px;
  border: 0;
  border-radius: 999px;
  background: var(--omb-surface);
  box-shadow: var(--omb-shadow);
  color: var(--omb-text);
  text-align: left;
  font: inherit;
}
.pill-card.inbox {
  margin: 22px 0 0 6px;
  border-radius: 24px;
}
.pill-card.review {
  position: sticky;
  bottom: 14px;
  margin: 8px 16px 14px;
}
.pill-text {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.pill-text h2,
.strong {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
}
.pill-btn {
  flex: none;
  min-height: 38px;
  font-size: 14px;
}
</style>
