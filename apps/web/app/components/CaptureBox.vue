<script setup lang="ts">
import {
  IMAGE_MIMES,
  MAX_UPLOAD_BYTES,
  newId,
  parseCapture,
  type CreateItemInput,
  type ItemDto,
} from '@omb/shared'

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

/** Images waiting to be saved with the next capture. */
const images = ref<{ file: File; preview: string }[]>([])
const fileInput = useTemplateRef('fileInput')
const dragging = ref(false)

const canSave = computed(() =>
  Boolean(parsed.value?.body || parsed.value?.urls.length || images.value.length),
)

function addFiles(files: Iterable<File>) {
  for (const file of files) {
    if (!(IMAGE_MIMES as readonly string[]).includes(file.type) || file.size > MAX_UPLOAD_BYTES) {
      toast.add({ title: t('inbox.badImage'), color: 'warning' })
      continue
    }
    if (images.value.length < 10) images.value.push({ file, preview: URL.createObjectURL(file) })
  }
}

function removeImage(index: number) {
  const [img] = images.value.splice(index, 1)
  if (img) URL.revokeObjectURL(img.preview)
}

function onPaste(e: ClipboardEvent) {
  const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
  if (!files.length) return
  e.preventDefault()
  addFiles(files)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files)
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(input.files)
  input.value = ''
}

function focus() {
  textarea.value?.focus()
}
defineExpose({ focus })

function buildInput(): CreateItemInput | null {
  const p = parsed.value ?? { body: '', urls: [], tags: [], remember: false }
  const url = p.urls[0]
  const body = url
    ? p.body
        .replace(url, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    : p.body
  if (!body && !url && !images.value.length) return null
  const r = reminder.value
  return {
    id: newId(),
    kind: images.value.length ? 'IMAGE' : url ? 'LINK' : 'TEXT',
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

function localCopy(input: CreateItemInput, previews: string[]): ItemDto {
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
    attachments: previews.map((url) => ({
      id: url,
      kind: 'IMAGE' as const,
      mime: 'image/png',
      sizeBytes: 0,
      width: null,
      height: null,
      url,
    })),
    review: null,
  }
}

async function save() {
  const input = buildInput()
  if (!input) return
  const draft = text.value
  const draftImages = images.value
  text.value = ''
  images.value = []
  dismissed.value = null
  emit(
    'optimistic',
    localCopy(
      input,
      draftImages.map((i) => i.preview),
    ),
  )
  try {
    input.attachments = await Promise.all(draftImages.map((i) => api.upload(input.id, i.file)))
    emit('saved', await api.create(input))
    // Let the server copy load before dropping the local previews.
    setTimeout(() => draftImages.forEach((i) => URL.revokeObjectURL(i.preview)), 5000)
  } catch {
    emit('failed', input.id)
    text.value = draft
    images.value = draftImages
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
    :class="[
      'relative flex flex-col gap-2.5 rounded-2xl border-2 border-(--omb-accent) bg-(--omb-surface) px-4 pt-3.5 pb-3 shadow-[0_6px_20px_rgba(15,118,110,0.12)]',
      dragging && 'border-dashed',
    ]"
    @dragover.prevent="dragging = true"
    @dragleave.self="dragging = false"
    @drop.prevent="onDrop"
  >
    <div
      v-if="dragging"
      class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-(--omb-accent-soft)/90 text-sm font-semibold text-(--omb-accent)"
    >
      {{ t('inbox.dropHere') }}
    </div>
    <textarea
      ref="textarea"
      v-model="text"
      :aria-label="t('inbox.captureLabel')"
      :placeholder="t('inbox.capturePlaceholder')"
      rows="2"
      class="field-sizing-content max-h-80 min-h-[3lh] resize-none border-0 bg-transparent text-[17px] leading-normal font-medium outline-0 placeholder:font-normal placeholder:text-(--omb-text-muted)"
      @keydown="onKeydown"
      @paste="onPaste"
    />
    <div v-if="images.length" class="flex flex-wrap gap-2">
      <div v-for="(img, i) in images" :key="img.preview" class="relative">
        <img :src="img.preview" alt="" class="h-20 w-28 rounded-lg object-cover" />
        <button
          type="button"
          :aria-label="t('inbox.removeImage')"
          class="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-(--omb-border) bg-(--omb-surface) shadow-sm hover:bg-(--omb-hover)"
          @click="removeImage(i)"
        >
          <UIcon name="i-lucide-x" class="size-3.5" />
        </button>
      </div>
    </div>
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
      <input
        ref="fileInput"
        type="file"
        :accept="IMAGE_MIMES.join(',')"
        multiple
        class="hidden"
        @change="onPick"
      />
      <UButton
        icon="i-lucide-image"
        color="neutral"
        variant="outline"
        :aria-label="t('inbox.attachImage')"
        class="size-9 justify-center rounded-[10px]"
        @click="fileInput?.click()"
      />
      <UButton :disabled="!canSave" class="h-9 rounded-[10px] px-3.5 font-semibold" @click="save">
        {{ t('inbox.save') }}
        <span class="text-xs opacity-85">⏎</span>
      </UButton>
    </div>
  </div>
</template>
