<script setup lang="ts">
import type { ItemDto } from '@omb/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLongPress } from '../composables/useLongPress'
import { formatter, itemTitle } from '../lib/format'
import ItemChips from './ItemChips.vue'
import KindIcon from './KindIcon.vue'

const props = withDefaults(defineProps<{ item: ItemDto; showStatus?: boolean }>(), {
  showStatus: false,
})
const emit = defineEmits<{ open: [item: ItemDto]; hold: [item: ItemDto] }>()

const { t } = useI18n()
const press = useLongPress(() => emit('hold', props.item))

const meta = computed(() =>
  [
    t(`mobile.kind.${props.item.kind}`),
    props.showStatus ? t(`statuses.${props.item.status}`) : t(`sources.${props.item.source}`),
    formatter.value.relative(props.item.capturedAt),
  ].join(' · '),
)
const thumb = computed(() => props.item.attachments.find((a) => a.kind !== 'AUDIO')?.url ?? null)
</script>

<template>
  <button type="button" class="row omb-card" v-bind="press" @click="emit('open', item)">
    <KindIcon :kind="item.kind" />
    <span class="body">
      <span class="title">{{ itemTitle(item) }}</span>
      <span class="omb-meta">{{ meta }}</span>
      <ItemChips :item="item" />
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
  padding: 12px 14px;
  text-align: left;
  color: var(--omb-text);
  font: inherit;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.body {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.title {
  font-size: 14.5px;
  font-weight: 500;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.omb-meta {
  font-size: 12px;
}
.thumb {
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--omb-hover);
}
</style>
