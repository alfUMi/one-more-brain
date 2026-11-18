<script setup lang="ts">
import type { SnoozePreset, TodayDto, TodayEntry } from '@omb/shared'

const { t, locale } = useI18n()
useHead({ title: () => t('today.title') })

const api = useItemsApi()
const fmt = useFormat()
const toast = useToast()
const sidebar = useSidebar()

const data = ref<TodayDto | null>(null)
const failed = ref(false)

async function load() {
  try {
    data.value = await api.today()
    failed.value = false
  } catch {
    failed.value = !data.value
  }
  void sidebar.refresh()
}
onMounted(load)
// "In 25 minutes" and which reminder is next both move with the clock.
const now = ref(Date.now())
const ticker = setInterval(() => (now.value = Date.now()), 30_000)
onBeforeUnmount(() => clearInterval(ticker))
watch(now, () => {
  const next = data.value?.reminders.find((r) => r.state === 'next')
  if (next?.reminder.fireAt && new Date(next.reminder.fireAt).getTime() <= now.value) void load()
})

const dateLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: fmt.timeZone.value,
  }).format(new Date(now.value)),
)

const left = computed(
  () => data.value?.reminders.filter((r) => r.state !== 'done' && r.state !== 'past').length ?? 0,
)

function text(entry: { item: TodayEntry['item'] }) {
  const i = entry.item
  return i.title ?? i.body ?? i.quote ?? i.extractedText ?? i.pageTitle ?? i.url ?? ''
}

function inLabel(at: string | null) {
  if (!at) return ''
  const minutes = Math.max(1, Math.round((new Date(at).getTime() - now.value) / 60_000))
  const unit = (n: number, u: 'minute' | 'hour') =>
    new Intl.NumberFormat(locale.value, { style: 'unit', unit: u, unitDisplay: 'long' }).format(n)
  return t('today.in', {
    time: minutes < 60 ? unit(minutes, 'minute') : unit(Math.round(minutes / 60), 'hour'),
  })
}

async function done(entry: TodayEntry) {
  try {
    await api.updateReminder(entry.reminder.id, { status: 'DONE' })
    toast.add({ title: t('today.markedDone') })
  } catch {
    toast.add({ title: t('toasts.saveFailed'), color: 'error' })
  }
  void load()
}

async function snooze(entry: TodayEntry, preset: SnoozePreset) {
  try {
    const r = await api.snooze(entry.reminder.id, { preset })
    toast.add({ title: t('today.snoozed', { when: fmt.when(r.fireAt!) }) })
  } catch {
    toast.add({ title: t('toasts.saveFailed'), color: 'error' })
  }
  void load()
}

const captured = computed(() => data.value?.captured ?? [])
const upcoming = computed(() => data.value?.upcoming ?? [])
const remembering = computed(() => data.value?.remembering ?? [])
const isDue = (at: string) => new Date(at).getTime() <= now.value

/** "Now" goes before the first reminder still ahead today. */
const nowIndex = computed(() => {
  const list = data.value?.reminders ?? []
  const i = list.findIndex((r) => r.state === 'next' || r.state === 'later')
  return i === -1 ? list.length : i
})
const weekday = (at: string) =>
  new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: fmt.timeZone.value }).format(
    new Date(at),
  )
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: fmt.timeZone.value })
/** Time for today's reminders; the weekday for missed ones from earlier days. */
function railTime(at: string | null) {
  if (!at) return ''
  const d = new Date(at)
  return dayKey(d) === dayKey(new Date(now.value)) ? fmt.time(d) : weekday(at)
}
const firstDue = computed(() => data.value?.reviews[0] ?? null)

const snoozeMenu = (entry: TodayEntry) => [
  [
    { label: t('reminder.inHour'), onSelect: () => snooze(entry, '1h') },
    { label: t('reminder.evening'), onSelect: () => snooze(entry, 'tonight') },
    { label: t('reminder.tomorrow'), onSelect: () => snooze(entry, 'tomorrow') },
  ],
]
</script>

<template>
  <div class="flex flex-col">
    <header class="flex flex-col gap-1.5 pb-[22px] md:pl-[98px]">
      <h1 class="text-[36px] leading-tight font-semibold">{{ t('today.title') }}</h1>
      <span class="text-[15px] text-(--omb-text-muted)">
        <span class="inline-block first-letter:uppercase">{{ dateLabel }}</span>
        <template v-if="data">
          · {{ left ? t('today.leftToday', { n: left }) : t('today.allDone') }}
        </template>
      </span>
    </header>
    <PushPrompt class="mb-4" />

    <section v-if="failed" class="omb-panel" role="alert">
      <p class="m-0">{{ t('today.loadFailed') }}</p>
      <button type="button" class="omb-btn self-start" @click="load">{{ t('today.retry') }}</button>
    </section>

    <template v-if="data">
      <!-- Reminders today, with a "Now" marker between what's behind and what's ahead. -->
      <section :aria-label="t('today.reminders')">
        <p v-if="!data.reminders.length" class="omb-meta m-0 pb-2 md:pl-[98px]">
          {{ t('today.noReminders') }}
        </p>
        <template v-for="(entry, i) in data.reminders" :key="entry.reminder.id">
          <div v-if="i === nowIndex" class="omb-ev">
            <span class="omb-time font-semibold text-(--omb-rem-text)!">{{ t('today.now') }}</span>
            <span class="omb-rail"><span class="omb-node omb-node-now" /></span>
            <span class="flex items-center gap-2.5 pt-3.5 pb-1.5">
              <span class="h-px flex-1 bg-(--omb-rem-dot) opacity-45" />
              <span class="omb-meta">{{ fmt.time(new Date(now)) }}</span>
            </span>
          </div>
          <div
            :class="['omb-ev', (entry.state === 'done' || entry.state === 'past') && 'opacity-50']"
          >
            <span
              :class="['omb-time', entry.state === 'next' && 'font-semibold text-(--omb-text)!']"
            >
              {{ railTime(entry.reminder.fireAt) }}
            </span>
            <span class="omb-rail">
              <span
                :class="[
                  'omb-node',
                  entry.state === 'done' || entry.state === 'past'
                    ? 'omb-node-done'
                    : entry.state === 'next' || entry.state === 'missed'
                      ? 'omb-node-hot'
                      : 'omb-node-rem',
                ]"
              />
            </span>
            <div
              :class="[
                'omb-item',
                (entry.state === 'next' || entry.state === 'missed') && 'omb-item-card',
              ]"
            >
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  :class="[
                    'text-[15.5px] leading-snug break-words',
                    entry.state === 'done' && 'line-through',
                    entry.state === 'next' && 'font-medium',
                  ]"
                >
                  {{ text(entry) }}
                </span>
                <span v-if="entry.state === 'next'" class="omb-meta text-(--omb-rem-text)!">
                  {{ inLabel(entry.reminder.fireAt) }}
                </span>
                <span v-else-if="entry.state === 'missed'" class="omb-meta text-(--omb-rem-text)!">
                  {{ t('today.overdue', { when: fmt.when(entry.reminder.fireAt!) }) }}
                </span>
              </span>
              <span v-if="entry.state === 'done'" class="omb-meta">{{ t('today.done') }}</span>
              <template
                v-else-if="
                  entry.reminder.kind === 'TIME' &&
                  (entry.state === 'next' || entry.state === 'missed')
                "
              >
                <UDropdownMenu :items="snoozeMenu(entry)" :content="{ align: 'end' }">
                  <button type="button" class="omb-btn">{{ t('today.snooze') }}</button>
                </UDropdownMenu>
                <button type="button" class="omb-btn omb-btn-primary" @click="done(entry)">
                  {{ t('today.done') }}
                </button>
              </template>
              <span v-else-if="entry.reminder.rrule" class="omb-meta">
                {{ fmt.recurrence(entry.reminder.rrule).replace(/, \d\d:\d\d$/, '') }}
              </span>
              <span v-else-if="entry.item.tags[0]" class="omb-chip omb-chip-tag">
                {{ entry.item.tags[0].name }}
              </span>
            </div>
          </div>
        </template>
        <div v-if="data.reminders.length && nowIndex === data.reminders.length" class="omb-ev">
          <span class="omb-time font-semibold text-(--omb-rem-text)!">{{ t('today.now') }}</span>
          <span class="omb-rail"><span class="omb-node omb-node-now" /></span>
          <span class="flex items-center gap-2.5 pt-3.5 pb-1.5">
            <span class="h-px flex-1 bg-(--omb-rem-dot) opacity-45" />
            <span class="omb-meta">{{ fmt.time(new Date(now)) }}</span>
          </span>
        </div>
      </section>

      <section aria-labelledby="cap-h">
        <h2 id="cap-h" class="omb-label pt-[30px] pb-2.5 md:pl-[98px]">
          {{ t('today.captured') }}{{ captured.length ? ` · ${captured.length}` : '' }}
        </h2>
        <p v-if="!captured.length" class="omb-meta m-0 md:pl-[98px]">
          {{ t('today.nothingCaptured') }}
        </p>
        <div v-for="item in captured" :key="item.id" class="omb-ev">
          <span class="omb-time">{{ fmt.time(new Date(item.capturedAt)) }}</span>
          <span class="omb-rail"><span class="omb-node" /></span>
          <NuxtLink :to="item.status === 'INBOX' ? '/' : '/library'" class="omb-item">
            <span
              :class="[
                'min-w-0 flex-1 leading-snug break-words',
                item.kind === 'HIGHLIGHT' ? 'omb-quote text-[16.5px]' : 'text-[15.5px]',
              ]"
            >
              {{ item.kind === 'HIGHLIGHT' && item.quote ? `“${item.quote}”` : text({ item }) }}
            </span>
            <span class="omb-meta flex-none">{{ t(`statuses.${item.status}`) }}</span>
          </NuxtLink>
        </div>
      </section>

      <section aria-labelledby="up-h">
        <h2 id="up-h" class="omb-label pt-[30px] pb-2.5 md:pl-[98px]">{{ t('today.upcoming') }}</h2>
        <p v-if="!upcoming.length" class="omb-meta m-0 md:pl-[98px]">
          {{ t('today.nothingUpcoming') }}
        </p>
        <div v-for="entry in upcoming" :key="entry.reminder.id" class="omb-ev">
          <span class="omb-time first-letter:uppercase">
            {{ entry.reminder.fireAt ? weekday(entry.reminder.fireAt) : '' }}
          </span>
          <span class="omb-rail"><span class="omb-node omb-node-rem" /></span>
          <div class="omb-item">
            <span class="min-w-0 flex-1 text-[15.5px] leading-snug break-words">{{
              text(entry)
            }}</span>
            <span class="omb-meta flex-none">
              {{ entry.reminder.fireAt ? fmt.time(new Date(entry.reminder.fireAt)) : '' }}
            </span>
          </div>
        </div>
      </section>

      <div class="flex flex-col gap-3 pt-[34px] md:pl-[98px]">
        <NuxtLink
          v-if="data.reviewsDue"
          to="/review"
          class="flex items-center gap-4 rounded-[18px] bg-(--omb-surface) px-5 py-[18px] shadow-(--omb-shadow)"
        >
          <span class="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span class="text-[15.5px] font-semibold">
              {{ t('today.cardsToRemember', { n: data.reviewsDue }) }}
            </span>
            <span class="text-[13.5px] break-words text-(--omb-text-muted)">
              {{ t('today.aboutMinutes', { n: Math.max(1, Math.ceil(data.reviewsDue / 2)) }) }}
              <template v-if="firstDue"> · “{{ text(firstDue) }}”</template>
            </span>
          </span>
          <span class="omb-btn omb-btn-primary h-[38px] px-[18px]">{{ t('today.review') }}</span>
        </NuxtLink>

        <section
          v-if="remembering.length"
          aria-labelledby="mem-h"
          class="flex flex-col gap-1 px-1 py-1"
        >
          <h2 id="mem-h" class="omb-label pb-1">
            {{ t('today.remember') }} · {{ t('today.remembering', { n: remembering.length }) }}
          </h2>
          <div
            v-for="card in remembering.slice(0, 6)"
            :key="card.item.id"
            class="flex items-baseline gap-3 py-1.5"
          >
            <span class="min-w-0 flex-1 truncate text-sm">{{ text(card) }}</span>
            <span class="omb-meta flex-none">
              {{
                isDue(card.nextAt)
                  ? t('today.dueNow')
                  : t('today.nextReview', { when: fmt.when(card.nextAt) })
              }}
            </span>
          </div>
        </section>
        <p v-else class="omb-meta m-0 px-1">{{ t('today.nothingRemembered') }}</p>

        <NuxtLink
          v-if="data.inbox.count"
          to="/"
          class="flex items-center gap-4 rounded-[18px] bg-(--omb-surface) px-5 py-4 shadow-(--omb-shadow)"
        >
          <span class="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span class="text-[15px] font-semibold">
              {{ t('today.inboxWaiting', { n: data.inbox.count }) }}
            </span>
            <span v-if="data.inbox.oldestCapturedAt" class="text-[13.5px] text-(--omb-text-muted)">
              {{ t('today.inboxOldest', { when: fmt.relative(data.inbox.oldestCapturedAt) }) }}
            </span>
          </span>
          <span class="omb-btn">{{ t('today.goToInbox') }}</span>
        </NuxtLink>
        <p v-else class="omb-meta m-0 px-1">{{ t('today.inboxZero') }}</p>

        <p
          v-for="entry in data.onThisDay"
          :key="entry.ago"
          class="m-0 px-1 text-[13.5px] break-words text-(--omb-text-muted)"
        >
          {{ t('today.onThisDay') }}, {{ t(`today.ago.${entry.ago}`).toLowerCase() }}: “{{
            text(entry)
          }}”
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.omb-ev {
  display: grid;
  grid-template-columns: 48px 18px minmax(0, 1fr);
  align-items: start;
  column-gap: 8px;
}
@media (min-width: 768px) {
  .omb-ev {
    grid-template-columns: 64px 22px minmax(0, 1fr);
    column-gap: 12px;
  }
}
.omb-time {
  padding-top: 15px;
  font-size: 14px;
  font-weight: 500;
  color: var(--omb-text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.omb-rail {
  position: relative;
  align-self: stretch;
  display: flex;
  justify-content: center;
}
.omb-rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--omb-border);
}
.omb-node {
  position: relative;
  margin-top: 19px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--omb-bg);
  border: 1.5px solid var(--omb-ai-border);
}
.omb-node-done {
  background: var(--omb-ai-border);
}
.omb-node-rem {
  border-color: var(--omb-rem-dot);
}
.omb-node-hot {
  border-color: var(--omb-rem-dot);
  background: var(--omb-rem-dot);
}
.omb-node-now {
  margin-top: 21px;
  width: 7px;
  height: 7px;
  border: 0;
  background: var(--omb-rem-dot);
}
.omb-item {
  margin: 4px 0;
  padding: 12px 16px;
  border-radius: 14px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  color: var(--omb-text);
}
a.omb-item:hover {
  background: var(--omb-surface);
}
.omb-item-card {
  padding: 14px 16px;
  background: var(--omb-surface);
  box-shadow: var(--omb-shadow);
}
</style>
