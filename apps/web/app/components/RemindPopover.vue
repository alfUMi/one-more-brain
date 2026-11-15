<script setup lang="ts">
import { fromLocal, parseCapture, toLocal } from '@omb/shared'
import type { RemindChoice } from '~/utils/remind'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ pick: [choice: RemindChoice] }>()

const { t } = useI18n()
const fmt = useFormat()

const custom = ref('')
watch(open, (on) => on && (custom.value = ''))

/** A wall-clock time `days` from today in the user's zone. */
function at(days: number, hour: number): Date {
  const l = toLocal(new Date(), fmt.timeZone.value)
  const d = new Date(Date.UTC(l.year, l.month - 1, l.day + days))
  return fromLocal(
    { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour, minute: 0 },
    fmt.timeZone.value,
  )
}

const quick = computed(() => {
  const now = new Date()
  const local = toLocal(now, fmt.timeZone.value)
  const inHour = new Date(Math.ceil((now.getTime() + 3_600_000) / 300_000) * 300_000)
  // Monday is weekday 1 in JS; days until the next one (never today).
  const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay()
  const toMonday = (8 - weekday) % 7 || 7
  const options = [
    { label: t('reminder.inHour'), at: inHour },
    ...(local.hour < 19 ? [{ label: t('reminder.evening'), at: at(0, 20) }] : []),
    { label: t('reminder.tomorrow'), at: at(1, 9) },
    { label: t('reminder.nextWeek'), at: at(toMonday, 9) },
  ]
  // Drop options that land within an hour of an earlier one ("next Monday" on a Sunday).
  return options.filter(
    (o, i) =>
      !options.slice(0, i).some((p) => Math.abs(p.at.getTime() - o.at.getTime()) < 3_600_000),
  )
})

const parsedCustom = computed(() =>
  custom.value.trim()
    ? parseCapture(custom.value, { now: new Date(), timeZone: fmt.timeZone.value }).reminder
    : null,
)

function pick(choice: RemindChoice) {
  emit('pick', choice)
  open.value = false
}

function submitCustom() {
  const r = parsedCustom.value
  if (r) pick({ kind: r.kind, fireAt: r.fireAt, rrule: r.rrule })
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'start' }">
    <slot />
    <template #content>
      <div class="flex w-72 flex-col gap-1 p-2" @click.stop>
        <button
          v-for="q in quick"
          :key="q.label"
          type="button"
          class="flex h-9 items-center justify-between rounded-md px-2.5 text-sm hover:bg-(--omb-hover)"
          @click="pick({ kind: 'TIME', fireAt: q.at })"
        >
          <span class="font-medium">{{ q.label }}</span>
          <span class="omb-meta">{{ fmt.when(q.at) }}</span>
        </button>
        <form
          class="mt-1 flex flex-col gap-1.5 border-t border-(--omb-border-muted) pt-2"
          @submit.prevent="submitCustom"
        >
          <label class="omb-meta px-1" for="remind-custom">{{ t('reminder.custom') }}</label>
          <UInput
            id="remind-custom"
            v-model="custom"
            :placeholder="t('reminder.customPlaceholder')"
            autofocus
            size="md"
          />
          <p v-if="custom.trim()" class="omb-meta px-1">
            <span v-if="parsedCustom" class="omb-chip omb-chip-rem">
              <UIcon
                :name="parsedCustom.kind === 'RECURRING' ? 'i-lucide-repeat' : 'i-lucide-clock'"
                class="size-3.5"
              />
              {{ fmt.reminder(parsedCustom) }}
            </span>
            <span v-else>{{ t('reminder.notUnderstood') }}</span>
          </p>
        </form>
      </div>
    </template>
  </UPopover>
</template>
