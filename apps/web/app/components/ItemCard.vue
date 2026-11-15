<script setup lang="ts">
import type { ItemDto, ItemKind, ItemStatus } from '@omb/shared'
import type { RemindChoice } from '~/utils/remind'

const props = defineProps<{
  item: ItemDto
  selected?: boolean
  /** Inbox styling: Keep is the primary action. */
  triage?: boolean
}>()
const editing = defineModel<boolean>('editing', { default: false })
const tagging = defineModel<boolean>('tagging', { default: false })
const remindOpen = defineModel<boolean>('remindOpen', { default: false })

const emit = defineEmits<{
  select: []
  status: [status: ItemStatus]
  remember: []
  remind: [choice: RemindChoice]
  acceptReminder: [id: string]
  removeReminder: [id: string]
  saveBody: [body: string]
  addTag: [name: string]
  delete: []
}>()

const { t } = useI18n()
const fmt = useFormat()

const KIND_STYLE: Record<ItemKind, { icon: string; bg: string; fg: string }> = {
  TEXT: { icon: 'i-lucide-align-left', bg: 'var(--omb-kind-bg)', fg: 'var(--omb-kind-text)' },
  HIGHLIGHT: {
    icon: 'i-lucide-highlighter',
    bg: 'var(--omb-highlight-bg)',
    fg: 'var(--omb-highlight-text)',
  },
  VOICE: { icon: 'i-lucide-mic', bg: 'var(--omb-voice-bg)', fg: 'var(--omb-voice-text)' },
  IMAGE: { icon: 'i-lucide-image', bg: 'var(--omb-image-bg)', fg: 'var(--omb-image-text)' },
  LINK: { icon: 'i-lucide-link', bg: 'var(--omb-link-bg)', fg: 'var(--omb-link-text)' },
}
const kind = computed(() => KIND_STYLE[props.item.kind])

const heading = computed(() => {
  const i = props.item
  if (i.title) return i.title
  if (i.kind === 'LINK' || i.kind === 'HIGHLIGHT') return i.pageTitle ?? null
  return null
})
const text = computed(() => {
  const i = props.item
  if (i.kind === 'LINK' && !heading.value && !i.body) return null
  return i.body
})
const linkLabel = computed(() => {
  if (!props.item.url) return null
  try {
    const u = new URL(props.item.url)
    return (u.host + u.pathname).replace(/^www\./, '').replace(/\/$/, '')
  } catch {
    return props.item.url
  }
})
const STATUS_ACTIONS = [
  { status: 'KEPT', label: 'actions.keep', key: 'K' },
  { status: 'ARCHIVED', label: 'actions.archive', key: 'A' },
  { status: 'DONE', label: 'actions.done', key: 'D' },
] as const
const statusActions = computed(() => STATUS_ACTIONS.filter((a) => a.status !== props.item.status))

const hasAiTags = computed(() => props.item.tags.some((tag) => tag.suggested))

// ── Inline edit ──
const draft = ref('')
const editor = useTemplateRef('editor')
watch(editing, async (on) => {
  if (!on) return
  draft.value = props.item.body ?? ''
  await nextTick()
  editor.value?.focus()
})
function onEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') editing.value = false
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commitEdit()
}
function commitEdit() {
  editing.value = false
  if (draft.value.trim() !== (props.item.body ?? '').trim()) emit('saveBody', draft.value.trim())
}

// ── Tag input ──
const tagDraft = ref('')
const tagInput = useTemplateRef('tagInput')
watch(tagging, async (on) => {
  if (!on) return
  tagDraft.value = ''
  await nextTick()
  tagInput.value?.focus()
})
function onTagKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') tagging.value = false
  if (e.key === 'Enter') {
    e.preventDefault()
    const name = tagDraft.value.trim().replace(/^#/, '').toLowerCase()
    if (/^[\p{L}\p{N}_-]{1,40}$/u.test(name)) emit('addTag', name)
    tagging.value = false
  }
}

const menu = computed(() => [
  [
    { label: t('actions.edit'), icon: 'i-lucide-pencil', onSelect: () => (editing.value = true) },
    { label: t('actions.tag'), icon: 'i-lucide-hash', onSelect: () => (tagging.value = true) },
  ],
  [
    ...(props.item.status !== 'INBOX'
      ? [
          {
            label: t('actions.moveToInbox'),
            icon: 'i-lucide-inbox',
            onSelect: () => emit('status', 'INBOX'),
          },
        ]
      : []),
    {
      label: t('actions.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => emit('delete'),
    },
  ],
])
</script>

<template>
  <article
    :class="[
      'flex flex-col gap-3 rounded-[14px] bg-(--omb-surface) px-[18px] py-4 transition-colors',
      selected
        ? 'border-2 border-(--omb-accent) px-[17px] py-[15px]'
        : 'border border-(--omb-border)',
    ]"
    :aria-current="selected || undefined"
    @click="emit('select')"
  >
    <div class="flex gap-3.5">
      <div
        class="flex size-9 flex-none items-center justify-center rounded-[10px]"
        :style="{ background: kind.bg, color: kind.fg }"
      >
        <UIcon :name="kind.icon" class="size-[18px]" />
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div v-if="heading" class="text-[15px] font-semibold break-words">{{ heading }}</div>
        <blockquote
          v-if="item.quote"
          class="m-0 rounded-lg bg-(--omb-highlight-quote) px-3 py-2 text-[14.5px] leading-normal text-(--omb-quote-text)"
        >
          “{{ item.quote }}”
        </blockquote>

        <textarea
          v-if="editing"
          ref="editor"
          v-model="draft"
          :aria-label="t('item.edit')"
          class="field-sizing-content min-h-[3lh] w-full resize-none rounded-lg border border-(--omb-border) bg-(--omb-surface-muted) px-3 py-2 text-[15px] leading-normal outline-0 focus:border-(--omb-accent)"
          @keydown="onEditKeydown"
          @click.stop
        />
        <p
          v-else-if="text"
          :class="[
            'm-0 leading-[1.45] break-words whitespace-pre-line',
            heading ? 'line-clamp-4 text-[14.5px] text-(--omb-quote-text)' : 'text-[15.5px]',
          ]"
        >
          {{ text }}
        </p>
        <div v-if="editing" class="flex gap-2" @click.stop>
          <UButton size="sm" @click="commitEdit">{{ t('actions.save') }}</UButton>
          <UButton size="sm" color="neutral" variant="ghost" @click="editing = false">
            {{ t('actions.cancel') }}
          </UButton>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <template v-for="r in item.reminders" :key="r.id">
            <template v-if="r.isAiSuggested">
              <span class="omb-chip omb-chip-rem-ai">
                <UIcon name="i-lucide-clock" class="size-3.5" />
                {{ t('reminder.suggested', { when: fmt.reminder(r) }) }}
              </span>
              <button
                type="button"
                class="h-[26px] rounded-full bg-(--omb-rem-solid) px-2.5 text-[12.5px] font-semibold text-(--omb-surface)"
                @click.stop="emit('acceptReminder', r.id)"
              >
                {{ t('actions.accept') }}
              </button>
            </template>
            <span v-else class="omb-chip omb-chip-rem group pr-1">
              <UIcon
                :name="r.kind === 'RECURRING' ? 'i-lucide-repeat' : 'i-lucide-clock'"
                class="size-3.5"
              />
              {{ fmt.reminder(r) }}
              <button
                type="button"
                :aria-label="t('reminder.remove')"
                class="flex size-5 items-center justify-center rounded-full opacity-60 hover:bg-black/10 hover:opacity-100"
                @click.stop="emit('removeReminder', r.id)"
              >
                <UIcon name="i-lucide-x" class="size-3" />
              </button>
            </span>
          </template>
          <span v-if="item.review" class="omb-chip omb-chip-tag">
            <UIcon name="i-lucide-refresh-cw" class="size-3.5" />
            {{ t('item.review', { when: fmt.relative(item.review.nextAt) }) }}
          </span>
          <NuxtLink
            v-for="tag in item.tags"
            :key="tag.name"
            :to="{ path: '/library', query: { tag: tag.name } }"
            :class="['omb-chip', tag.suggested ? 'omb-chip-ai' : 'omb-chip-tag']"
            @click.stop
          >
            #{{ tag.name }}
          </NuxtLink>
          <input
            v-if="tagging"
            ref="tagInput"
            v-model="tagDraft"
            :aria-label="t('item.addTag')"
            :placeholder="t('item.tagPlaceholder')"
            class="h-[26px] w-32 rounded-full border border-(--omb-accent) bg-(--omb-surface) px-2.5 text-[13px] outline-0"
            @keydown="onTagKeydown"
            @blur="tagging = false"
            @click.stop
          />
          <a
            v-if="item.url && linkLabel"
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="omb-meta max-w-64 truncate text-(--omb-link-text)! hover:underline"
            @click.stop
          >
            {{ linkLabel }}
          </a>
          <span class="omb-meta">
            <template v-if="hasAiTags">{{ t('item.aiTags') }} · </template>
            <template v-if="!triage">{{ t(`statuses.${item.status}`) }} · </template>
            {{ t(`sources.${item.source}`) }} · {{ fmt.relative(item.capturedAt) }}
          </span>
        </div>
      </div>

      <UDropdownMenu :items="menu" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          size="sm"
          class="self-start"
          :aria-label="t('actions.edit')"
          @click.stop
        />
      </UDropdownMenu>
    </div>

    <div
      v-if="selected"
      role="toolbar"
      :aria-label="t('inbox.triage')"
      class="flex flex-wrap gap-1.5 border-t border-(--omb-border-muted) pt-3"
      @click.stop
    >
      <button
        v-for="a in statusActions"
        :key="a.status"
        type="button"
        :class="['omb-act', a.status === 'KEPT' && triage && 'omb-act-primary']"
        @click="emit('status', a.status)"
      >
        {{ t(a.label) }} <span class="omb-kbd">{{ a.key }}</span>
      </button>
      <RemindPopover v-model:open="remindOpen" @pick="emit('remind', $event)">
        <button type="button" class="omb-act">
          {{ t('actions.remind') }} <span class="omb-kbd">R</span>
        </button>
      </RemindPopover>
      <button type="button" class="omb-act" @click="emit('remember')">
        {{ t('actions.remember') }} <span class="omb-kbd">M</span>
      </button>
    </div>
  </article>
</template>

<style scoped>
.omb-act {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--omb-border);
  border-radius: 9px;
  background: var(--omb-surface);
  font-size: 13px;
  font-weight: 500;
  color: var(--omb-text);
}
.omb-act:hover {
  background: var(--omb-hover);
}
.omb-act-primary,
.omb-act-primary:hover {
  border-color: var(--omb-accent);
  background: var(--omb-accent);
  color: var(--omb-on-accent);
}
.omb-act-primary .omb-kbd {
  color: var(--omb-text);
}
</style>
