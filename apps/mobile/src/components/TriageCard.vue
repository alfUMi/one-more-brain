<script setup lang="ts">
import type { ItemDto } from '@omb/shared'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatter, hostOf, itemTitle } from '../lib/format'
import ItemChips from './ItemChips.vue'

/** The big card in the Inbox stack (mockup: Mobile · Inbox). */
const props = defineProps<{ item: ItemDto }>()
const { t } = useI18n()

const meta = computed(() =>
  [
    t(`mobile.kind.${props.item.kind}`),
    t(`sources.${props.item.source}`),
    formatter.value.relative(props.item.capturedAt),
  ].join(' · '),
)
const title = computed(
  () => props.item.title ?? (props.item.quote || props.item.url ? props.item.pageTitle : null),
)
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
    <span class="meta">{{ meta }}</span>
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
  border-radius: 26px;
  padding: 26px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}
.meta {
  font-size: 13px;
  color: var(--omb-text-muted);
}
.title {
  margin: 0;
  font-size: 23px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
.quote {
  margin: 0;
  font-family: var(--omb-quote-font);
  font-size: 19px;
  line-height: 1.55;
  color: var(--omb-quote-text);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 8;
  -webkit-box-orient: vertical;
}
.body {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: var(--omb-text-toned);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 8;
  -webkit-box-orient: vertical;
}
.body.big {
  font-size: 23px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--omb-text);
}
.image {
  width: 100%;
  min-height: 0;
  max-height: 200px;
  object-fit: cover;
  border-radius: 16px;
  background: var(--omb-hover);
}
.host {
  font-size: 13px;
  color: var(--omb-link);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.grow {
  flex-grow: 1;
}
</style>
