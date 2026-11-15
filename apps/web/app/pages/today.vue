<script setup lang="ts">
import type { SnoozePreset, TodayDto, TodayEntry } from '@omb/shared'

const { t, locale } = useI18n()
useHead({ title: () => t('today.title') })

const api = useItemsApi()
const fmt = useFormat()
const toast = useToast()
const sidebar = useSidebar()

const data = ref<TodayDto | null>(null)
const loading = ref(true)

async function load() {
  try {
    data.value = await api.today()
  } finally {
    loading.value = false
  }
}
onMounted(load)

const dateLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: fmt.timeZone.value,
  }).format(new Date()),
)

const sections = computed(() =>
  data.value
    ? (
        [
          { key: 'missed', title: t('today.missed'), entries: data.value.missed },
          { key: 'today', title: t('today.later'), entries: data.value.today },
          { key: 'upcoming', title: t('today.upcoming'), entries: data.value.upcoming },
        ] as const
      ).filter((s) => s.entries.length)
    : [],
)

function text(entry: TodayEntry) {
  const i = entry.item
  return i.title ?? i.body ?? i.quote ?? i.pageTitle ?? i.url ?? ''
}

/** Missed entries show when they fired; the rest the day and time they will fire. */
function timeLabel(entry: TodayEntry, section: string) {
  const at = entry.reminder.fireAt
  if (!at) return ''
  return section === 'today' ? fmt.time(new Date(at)) : fmt.when(at)
}

function drop(reminderId: string) {
  if (!data.value) return
  for (const key of ['missed', 'today', 'upcoming'] as const) {
    data.value[key] = data.value[key].filter((e) => e.reminder.id !== reminderId)
  }
}

async function done(entry: TodayEntry) {
  drop(entry.reminder.id)
  try {
    await api.updateReminder(entry.reminder.id, { status: 'DONE' })
    toast.add({ title: t('today.done') })
  } catch {
    toast.add({ title: t('toasts.saveFailed'), color: 'error' })
  }
  void load()
  void sidebar.refresh()
}

async function snooze(entry: TodayEntry, preset: SnoozePreset) {
  try {
    const r = await api.snooze(entry.reminder.id, { preset })
    toast.add({ title: t('today.snoozed', { when: fmt.when(r.fireAt!) }) })
  } catch {
    toast.add({ title: t('toasts.saveFailed'), color: 'error' })
  }
  void load()
  void sidebar.refresh()
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
  <section class="flex max-w-[820px] flex-col gap-[18px]">
    <header class="flex flex-wrap items-baseline gap-3">
      <h1 class="text-[30px] font-bold">{{ t('today.title') }}</h1>
      <span class="text-sm text-(--omb-text-muted) first-letter:uppercase">{{ dateLabel }}</span>
    </header>

    <PushPrompt />

    <div
      v-for="section in sections"
      :key="section.key"
      class="flex flex-col gap-1 rounded-[14px] border border-(--omb-border) bg-(--omb-surface) px-[18px] py-4"
    >
      <h2
        :class="[
          'mb-1 text-base font-semibold',
          section.key === 'missed' && 'text-(--omb-rem-text)',
        ]"
      >
        {{ section.title }}
      </h2>
      <div
        v-for="entry in section.entries"
        :key="entry.reminder.id"
        class="flex items-start gap-3 border-t border-(--omb-border-muted) py-2.5 first-of-type:border-t-0"
      >
        <span
          class="w-[116px] flex-none pt-0.5 text-[13px] font-semibold text-(--omb-rem-text) tabular-nums"
        >
          <UIcon
            v-if="entry.reminder.kind === 'RECURRING'"
            name="i-lucide-repeat"
            class="mr-1 size-3 align-[-1px]"
          />
          {{ timeLabel(entry, section.key) }}
        </span>
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <NuxtLink
            :to="{ path: '/library', query: { q: text(entry).slice(0, 60) } }"
            :title="t('today.open')"
            class="line-clamp-2 text-[14.5px] break-words hover:underline"
          >
            {{ text(entry) }}
          </NuxtLink>
          <div v-if="entry.item.tags.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="tag in entry.item.tags"
              :key="tag.name"
              :class="['omb-chip h-[22px] text-xs', tag.suggested ? 'omb-chip-ai' : 'omb-chip-tag']"
            >
              #{{ tag.name }}
            </span>
          </div>
        </div>
        <div v-if="entry.reminder.kind === 'TIME'" class="flex flex-none gap-1.5">
          <UDropdownMenu :items="snoozeMenu(entry)" :content="{ align: 'end' }">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-alarm-clock"
              :aria-label="t('today.snooze')"
              :title="t('today.snooze')"
            />
          </UDropdownMenu>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-check"
            :aria-label="t('actions.done')"
            :title="t('actions.done')"
            @click="done(entry)"
          />
        </div>
      </div>
    </div>

    <div
      v-if="!loading && !sections.length"
      class="flex flex-col items-center gap-2 rounded-[14px] border border-(--omb-border) bg-(--omb-surface) px-6 py-12 text-center"
    >
      <span
        class="mb-1 flex size-10 items-center justify-center rounded-[10px] bg-(--omb-rem-bg) text-(--omb-rem-text)"
      >
        <UIcon name="i-lucide-sun" class="size-5" />
      </span>
      <h2 class="text-lg font-semibold">{{ t('today.emptyTitle') }}</h2>
      <p class="max-w-sm text-sm text-(--omb-text-muted)">{{ t('today.emptyBody') }}</p>
    </div>
  </section>
</template>
