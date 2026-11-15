<script setup lang="ts">
import { newId, parseCapture, type CreateItemInput, type ItemDto } from '@omb/shared'

const emit = defineEmits<{
  /** Fired right away with a local copy, before the server answers. */
  optimistic: [item: ItemDto]
  saved: [item: ItemDto]
  failed: [id: string]
}>()

const { t } = useI18n()
const fmt = useFormat()
const api = useItemsApi()
const toast = useToast()

const text = ref('')
const textarea = useTemplateRef('textarea')
/** Reminder phrase the user dismissed; it stays ignored until the phrase changes. */
const dismissed = ref<string | null>(null)

const parsed = computed(() =>
  text.value.trim()
    ? parseCapture(text.value, { now: new Date(), timeZone: fmt.timeZone.value })
    : null,
)
const reminder = computed(() => {
  const r = parsed.value?.reminder
  return r && r.text !== dismissed.value ? r : null
})
const canSave = computed(() => Boolean(parsed.value?.body || parsed.value?.urls.length))

function focus() {
  textarea.value?.focus()
}
defineExpose({ focus })

function buildInput(): CreateItemInput | null {
  const p = parsed.value
  if (!p) return null
  const url = p.urls[0]
  const body = url
    ? p.body
        .replace(url, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    : p.body
  if (!body && !url) return null
  const r = reminder.value
  return {
    id: newId(),
    kind: url ? 'LINK' : 'TEXT',
    source: 'WEB',
    body: body || undefined,
    url,
    tags: p.tags,
    remember: p.remember,
    capturedAt: new Date(),
    reminder: r
      ? {
          id: newId(),
          kind: r.kind,
          fireAt: r.fireAt,
          rrule: r.rrule,
          timezone: fmt.timeZone.value,
        }
      : undefined,
  }
}

function localCopy(input: CreateItemInput): ItemDto {
  const now = new Date().toISOString()
  return {
    id: input.id,
    kind: input.kind,
    status: 'INBOX',
    source: input.source,
    title: null,
    titleIsAi: false,
    body: input.body ?? null,
    quote: null,
    url: input.url ?? null,
    pageTitle: null,
    favicon: null,
    aiStatus: 'PENDING',
    capturedAt: now,
    triagedAt: null,
    updatedAt: now,
    tags: (input.tags ?? []).map((name) => ({ name, suggested: false })),
    reminders: input.reminder
      ? [
          {
            id: input.reminder.id,
            itemId: input.id,
            kind: input.reminder.kind,
            status: 'ACTIVE',
            fireAt: (input.reminder.fireAt as Date).toISOString(),
            rrule: input.reminder.rrule ?? null,
            timezone: input.reminder.timezone,
            isAiSuggested: false,
          },
        ]
      : [],
    attachments: [],
    review: null,
  }
}

async function save() {
  const input = buildInput()
  if (!input) return
  const draft = text.value
  text.value = ''
  dismissed.value = null
  emit('optimistic', localCopy(input))
  try {
    emit('saved', await api.create(input))
  } catch {
    emit('failed', input.id)
    text.value = draft
    toast.add({ title: t('toasts.saveFailed'), color: 'error' })
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    void save()
  } else if (e.key === 'Escape') {
    textarea.value?.blur()
  }
}
</script>

<template>
  <div
    class="flex flex-col gap-2.5 rounded-2xl border-2 border-(--omb-accent) bg-(--omb-surface) px-4 pt-3.5 pb-3 shadow-[0_6px_20px_rgba(15,118,110,0.12)]"
  >
    <textarea
      ref="textarea"
      v-model="text"
      :aria-label="t('inbox.captureLabel')"
      :placeholder="t('inbox.capturePlaceholder')"
      rows="2"
      class="field-sizing-content max-h-80 min-h-[3lh] resize-none border-0 bg-transparent text-[17px] leading-normal font-medium outline-0 placeholder:font-normal placeholder:text-(--omb-text-muted)"
      @keydown="onKeydown"
    />
    <div class="flex flex-wrap items-center gap-2">
      <span v-if="reminder" class="omb-chip omb-chip-rem pr-1">
        <UIcon
          :name="reminder.kind === 'RECURRING' ? 'i-lucide-repeat' : 'i-lucide-clock'"
          class="size-3.5"
        />
        {{ fmt.reminder(reminder) }}
        <button
          type="button"
          :aria-label="t('reminder.remove')"
          class="flex size-5 items-center justify-center rounded-full hover:bg-black/10"
          @click="dismissed = reminder.text"
        >
          <UIcon name="i-lucide-x" class="size-3" />
        </button>
      </span>
      <span v-for="tag in parsed?.tags" :key="tag" class="omb-chip omb-chip-tag">#{{ tag }}</span>
      <span v-if="parsed?.remember" class="omb-chip omb-chip-tag">
        <UIcon name="i-lucide-refresh-cw" class="size-3.5" />
        {{ t('actions.remember') }}
      </span>
      <span v-if="reminder || parsed?.tags.length || parsed?.remember" class="omb-meta">
        {{ t('inbox.pickedUp') }}
      </span>
      <div class="flex-1" />
      <UButton :disabled="!canSave" class="h-9 rounded-[10px] px-3.5 font-semibold" @click="save">
        {{ t('inbox.save') }}
        <span class="text-xs opacity-85">⏎</span>
      </UButton>
    </div>
  </div>
</template>
