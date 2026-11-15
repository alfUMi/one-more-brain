<script setup lang="ts">
import type { SnoozePreset, TodayDto, TodayEntry } from '@omb/shared'

const { t, locale } = useI18n()
useHead({ title: () => t('today.title') })

const api = useItemsApi()
const fmt = useFormat()
const toast = useToast()
const sidebar = useSidebar()

const data = ref<TodayDto | null>(null)

async function load() {
  data.value = await api.today().catch(() => data.value)
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

const snoozeMenu = (entry: TodayEntry) => [
  [
    { label: t('reminder.inHour'), onSelect: () => snooze(entry, '1h') },
    { label: t('reminder.evening'), onSelect: () => snooze(entry, 'tonight') },
    { label: t('reminder.tomorrow'), onSelect: () => snooze(entry, 'tomorrow') },
  ],
]
</script>

<template>
  <section class="flex flex-col gap-[22px]">
    <header class="flex flex-wrap items-baseline gap-3">
      <h1 class="text-[30px] font-bold">{{ t('today.title') }}</h1>
      <span class="text-[15px] text-(--omb-text-muted) first-letter:uppercase">{{
        dateLabel
      }}</span>
    </header>

    <PushPrompt />

    <div v-if="data" class="flex flex-col gap-[18px] md:grid md:grid-cols-2 md:items-start">
      <!-- Two independent columns, so a short panel never leaves a gap under it.
           On narrow screens the columns dissolve (display: contents) and `order` sets the sequence. -->
      <div class="contents md:flex md:flex-col md:gap-[18px]">
        <!-- Reminders -->
        <section class="omb-panel order-1 md:order-none" aria-labelledby="rem-h">
          <div class="flex items-center gap-2.5">
            <h2 id="rem-h" class="text-lg font-semibold">{{ t('today.reminders') }}</h2>
            <span class="omb-meta">
              {{ left ? t('today.leftToday', { n: left }) : t('today.allDone') }}
            </span>
          </div>
          <p v-if="!data.reminders.length" class="omb-meta m-0">{{ t('today.noReminders') }}</p>
          <div v-else>
            <div
              v-for="entry in data.reminders"
              :key="entry.reminder.id"
              :class="[
                'flex items-center gap-3.5 border-t border-(--omb-border-muted) py-3',
                (entry.state === 'done' || entry.state === 'past') && 'opacity-55',
                entry.state === 'next' && '-mx-[22px] bg-(--omb-rem-bg)/60 px-[22px]',
              ]"
            >
              <span
                :class="[
                  'w-14 flex-none text-sm font-semibold tabular-nums',
                  entry.state === 'done' || entry.state === 'past'
                    ? 'text-(--omb-text-muted)'
                    : 'text-(--omb-rem-text)',
                ]"
              >
                {{ entry.reminder.fireAt ? fmt.time(new Date(entry.reminder.fireAt)) : '' }}
              </span>
              <div class="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span
                  :class="[
                    'text-[15px] break-words',
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
                <span v-else-if="entry.reminder.rrule && entry.state !== 'done'" class="omb-meta">
                  {{ fmt.recurrence(entry.reminder.rrule).replace(/, \d\d:\d\d$/, '') }}
                </span>
              </div>
              <span v-if="entry.state === 'done'" class="omb-meta">{{ t('today.done') }}</span>
              <template
                v-else-if="
                  entry.reminder.kind === 'TIME' &&
                  (entry.state === 'next' || entry.state === 'missed')
                "
              >
                <UDropdownMenu :items="snoozeMenu(entry)" :content="{ align: 'end' }">
                  <button type="button" class="omb-sm">{{ t('today.snooze') }}</button>
                </UDropdownMenu>
                <button type="button" class="omb-sm omb-sm-solid" @click="done(entry)">
                  {{ t('today.done') }}
                </button>
              </template>
              <span
                v-else-if="entry.item.tags[0] && !entry.reminder.rrule"
                class="omb-chip omb-chip-tag h-6 text-[12.5px]"
              >
                #{{ entry.item.tags[0].name }}
              </span>
            </div>
          </div>
        </section>
      </div>
      <div class="contents md:flex md:flex-col md:gap-[18px]">
        <!-- On this day -->
        <section class="omb-panel order-2 md:order-none" aria-labelledby="otd-h">
          <h2 id="otd-h" class="text-lg font-semibold">{{ t('today.onThisDay') }}</h2>
          <p v-if="!data.onThisDay.length" class="omb-meta m-0">
            {{ t('today.nothingOnThisDay') }}
          </p>
          <div
            v-for="(entry, i) in data.onThisDay"
            :key="entry.ago"
            :class="[
              'flex flex-col gap-1',
              i ? 'border-t border-(--omb-border-muted) pt-3' : 'pt-1',
            ]"
          >
            <span class="omb-meta">{{ t(`today.ago.${entry.ago}`) }}</span>
            <span class="text-[15px] break-words">{{ text(entry) }}</span>
          </div>
        </section>
        <!-- Inbox summary -->
        <section class="omb-panel order-3 md:order-none" aria-labelledby="inb-h">
          <h2 id="inb-h" class="text-lg font-semibold">
            {{
              data.inbox.count
                ? t('today.inboxWaiting', { n: data.inbox.count })
                : t('inbox.zeroTitle')
            }}
          </h2>
          <p class="m-0 text-[14.5px] leading-normal text-(--omb-text-toned)">
            {{
              data.inbox.oldestCapturedAt
                ? t('today.inboxOldest', { when: fmt.relative(data.inbox.oldestCapturedAt) })
                : t('today.inboxZero')
            }}
          </p>
          <NuxtLink
            v-if="data.inbox.count"
            to="/"
            class="inline-flex h-[34px] items-center self-start rounded-[9px] border border-(--omb-accent) px-3.5 text-[13px] font-semibold text-(--omb-accent) hover:bg-(--omb-accent-soft)"
          >
            {{ t('today.goToInbox') }}
          </NuxtLink>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.omb-sm {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--omb-border);
  border-radius: 8px;
  background: var(--omb-surface);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
.omb-sm:hover {
  background: var(--omb-hover);
}
.omb-sm-solid,
.omb-sm-solid:hover {
  border-color: var(--omb-text);
  background: var(--omb-text);
  color: var(--omb-bg);
}
</style>
