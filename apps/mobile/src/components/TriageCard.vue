<script setup lang="ts">
import type { ItemDto } from '@omb/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatter, hostOf, itemTitle } from '../lib/format'
import ItemChips from './ItemChips.vue'
import KindIcon from './KindIcon.vue'

/** The big card in the Inbox stack (mockup: Mobile · Inbox swipe triage). */
const props = defineProps<{ item: ItemDto }>()
const { t } = useI18n()

const meta = computed(() =>
  [
    t(`mobile.kind.${props.item.kind}`),
    t(`sources.${props.item.source}`),
    formatter.value.relative(props.item.capturedAt),
  ].join(' · '),
)
const title = computed(() => props.item.title ?? (props.item.quote ? props.item.pageTitle : null))
/** Text under the title: the quote for highlights, else the note itself. */
const body = computed(() => {
  if (props.item.quote) return null
  const text = props.item.body ?? props.item.extractedText ?? ''
  return title.value ? text : text || itemTitle(props.item)
})
const image = computed(() => props.item.attachments.find((a) => a.kind !== 'AUDIO')?.url ?? null)
</script>

<template>
  <article class="card">
    <div class="meta-row">
      <KindIcon :kind="item.kind" />
      <span class="omb-meta">{{ meta }}</span>
    </div>
    <h2 v-if="title" class="title">{{ title }}</h2>
    <blockquote v-if="item.quote" class="quote">“{{ item.quote }}”</blockquote>
    <p v-if="body" class="body" :class="{ big: !title }">{{ body }}</p>
    <img v-if="image" :src="image" alt="" class="image" />
    <span v-if="item.url" class="host">{{ hostOf(item.url) }}</span>
    <div class="grow" />
    <ItemChips :item="item" :small="false" />
  </article>
</template>

<style scoped>
.card {
  height: 100%;
  box-sizing: border-box;
  background: var(--omb-surface);
  border: 1px solid var(--omb-border);
  border-radius: 22px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.quote {
  margin: 0;
  padding: 12px 14px;
  background: var(--omb-highlight-quote);
  border-radius: 12px;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 17px;
  line-height: 1.55;
  color: var(--omb-quote-text);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 7;
  -webkit-box-orient: vertical;
}
.body {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 8;
  -webkit-box-orient: vertical;
}
.body.big {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 21px;
  line-height: 1.35;
  font-weight: 500;
}
.image {
  width: 100%;
  min-height: 0;
  max-height: 200px;
  object-fit: cover;
  border-radius: 12px;
  background: var(--omb-hover);
}
.host {
  font-size: 13px;
  color: var(--omb-link);
}
.grow {
  flex-grow: 1;
}
</style>
