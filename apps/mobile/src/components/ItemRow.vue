<script setup lang="ts">
import type { ItemDto } from '@omb/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLongPress } from '../composables/useLongPress'
import { displayTitle, formatter, titleIsQuote } from '../lib/format'
import ItemChips from './ItemChips.vue'

/**
 * One note in a list. A white card in the Inbox list; `flat` is the Library row
 * (hairline between rows, chips inline after the meta).
 */
const props = withDefaults(defineProps<{ item: ItemDto; showStatus?: boolean; flat?: boolean }>(), {
  showStatus: false,
  flat: false,
})
const emit = defineEmits<{ open: [item: ItemDto]; hold: [item: ItemDto] }>()

const { t } = useI18n()
const press = useLongPress(() => emit('hold', props.item))

const meta = computed(() =>
  [
    t(`mobile.kind.${props.item.kind}`),
    props.showStatus ? t(`statuses.${props.item.status}`) : t(`sources.${props.item.source}`),
    props.flat
      ? formatter.value.when(props.item.capturedAt).replace(/, \d\d:\d\d$/, '')
      : formatter.value.relative(props.item.capturedAt),
  ].join(' · '),
)
const thumb = computed(() => props.item.attachments.find((a) => a.kind !== 'AUDIO')?.url ?? null)
</script>

<template>
  <button
    type="button"
    class="row"
    :class="{ flat, faded: flat && item.status === 'ARCHIVED' }"
    v-bind="press"
    @click="emit('open', item)"
  >
    <span class="body">
      <span class="title" :class="{ 'omb-quote': titleIsQuote(item) }">
        {{ displayTitle(item) }}
      </span>
      <span v-if="flat" class="line">
        <span class="omb-meta">{{ meta }}</span>
        <ItemChips :item="item" class="inline" />
      </span>
      <template v-else>
        <span class="omb-meta">{{ meta }}</span>
        <ItemChips :item="item" />
      </template>
    </span>
    <img v-if="thumb" :src="thumb" alt="" class="thumb" loading="lazy" />
  </button>
</template>

<style scoped>
.row {
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  border: 0;
  border-radius: 18px;
  background: var(--omb-surface);
  box-shadow: var(--omb-shadow-sm);
  text-align: left;
  color: var(--omb-text);
  font: inherit;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.row.flat {
  padding: 14px 4px;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  border-top: 1px solid var(--omb-border-muted);
}
.row.flat:active {
  background: var(--omb-hover);
}
.row.faded {
  opacity: 0.7;
}
.body {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.title {
  font-size: 15px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.inline {
  display: contents;
}
.thumb {
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  object-fit: cover;
  background: var(--omb-hover);
}
</style>
