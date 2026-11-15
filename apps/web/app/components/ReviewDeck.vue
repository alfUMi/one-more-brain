<script setup lang="ts">
import { REVIEW_INTERVALS_DAYS, type ReviewCardDto } from '@omb/shared'

/** Spaced-repetition cards, one at a time (Today › Review panel and the Review page). */
const props = defineProps<{ cards: ReviewCardDto[] }>()
const emit = defineEmits<{ answered: [] }>()

const { t } = useI18n()
const fmt = useFormat()
const api = useItemsApi()
const toast = useToast()

const index = ref(0)
const busy = ref(false)
watch(
  () => props.cards.map((c) => c.item.id).join(),
  () => (index.value = 0),
)

const card = computed(() => props.cards[index.value] ?? null)
const total = computed(() => props.cards.length)
const bars = computed(() => Math.min(total.value, 10))

const text = computed(() => {
  const i = card.value?.item
  if (!i) return ''
  return i.quote ?? i.body ?? i.title ?? i.extractedText ?? i.pageTitle ?? i.url ?? ''
})
/** A separate heading only when the main text is something else. */
const heading = computed(() => {
  const i = card.value?.item
  return i?.title && i.title !== text.value ? i.title : null
})
const nextDays = computed(() => {
  const step = card.value?.step ?? 0
  return step + 1 < REVIEW_INTERVALS_DAYS.length ? REVIEW_INTERVALS_DAYS[step + 1] : null
})

async function answer(gotIt: boolean) {
  if (!card.value || busy.value) return
  busy.value = true
  try {
    await api.answerReview(card.value.item.id, gotIt)
    index.value += 1
    emit('answered')
  } catch {
    toast.add({ title: t('toasts.saveFailed'), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="omb-panel border-2! border-(--omb-accent)!" aria-labelledby="review-h">
    <div class="flex items-center gap-2.5">
      <h2 id="review-h" class="text-lg font-semibold">{{ t('review.title') }}</h2>
      <span v-if="card" class="omb-meta">
        {{ t('review.cardOf', { i: index + 1, n: total }) }}
      </span>
      <div class="flex-1" />
      <div v-if="total" aria-hidden="true" class="flex gap-1">
        <span
          v-for="b in bars"
          :key="b"
          class="h-1 w-[22px] rounded-sm"
          :class="b - 1 <= index ? 'bg-(--omb-accent)' : 'bg-(--omb-border)'"
        />
      </div>
    </div>

    <template v-if="card">
      <div
        class="flex flex-col gap-3 rounded-xl bg-(--omb-surface-muted) px-[22px] pt-[22px] pb-[18px]"
      >
        <div class="omb-meta">
          {{ t('review.saved', { when: fmt.relative(card.item.capturedAt) }) }} ·
          {{ t(`review.from.${card.item.kind}`) }}
        </div>
        <div v-if="heading" class="font-semibold">{{ heading }}</div>
        <p
          class="font-display m-0 text-[22px] leading-[1.35] font-medium break-words whitespace-pre-line"
        >
          <template v-if="card.item.quote">“{{ text }}”</template>
          <template v-else>{{ text }}</template>
        </p>
        <div v-if="card.item.tags.length" class="flex flex-wrap gap-2">
          <span
            v-for="tag in card.item.tags"
            :key="tag.name"
            class="omb-chip omb-chip-tag h-6 text-[12.5px]"
          >
            #{{ tag.name }}
          </span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2.5">
        <button
          type="button"
          :disabled="busy"
          class="h-11 flex-[1_1_140px] rounded-[11px] border border-(--omb-border) bg-(--omb-surface) text-sm font-semibold hover:bg-(--omb-hover)"
          @click="answer(false)"
        >
          {{ t('review.forgot') }}
        </button>
        <button
          type="button"
          :disabled="busy"
          class="h-11 flex-[1_1_140px] rounded-[11px] bg-(--omb-accent) text-sm font-semibold text-(--omb-on-accent)"
          @click="answer(true)"
        >
          {{ nextDays ? t('review.gotIt', { n: nextDays }) : t('review.gotItLast') }}
        </button>
      </div>
    </template>

    <div v-else class="flex flex-col gap-1 rounded-xl bg-(--omb-surface-muted) px-[22px] py-6">
      <span class="font-semibold">{{ total ? t('review.finishedTitle') : t('review.title') }}</span>
      <span class="omb-meta">{{ total ? t('review.finishedBody') : t('review.emptyBody') }}</span>
    </div>
  </section>
</template>
