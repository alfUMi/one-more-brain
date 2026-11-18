<script setup lang="ts">
import { REVIEW_INTERVALS_DAYS, type ReviewCardDto } from '@omb/shared'

/** Spaced-repetition cards, one at a time (Today › Review panel and the Review page). */
const props = defineProps<{
  cards: ReviewCardDto[]
  /** The page already says "Review" (the Review tab), so the panel doesn't repeat it. */
  hideTitle?: boolean
}>()
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

// F = forgot, G = got it.
function onKeydown(e: KeyboardEvent) {
  if (!card.value || busy.value || e.metaKey || e.ctrlKey || e.altKey) return
  if ((e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable="true"]')) return
  const key = e.key.toLowerCase()
  if (key === 'f' || key === 'g') {
    e.preventDefault()
    void answer(key === 'g')
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section
    class="flex flex-col gap-7"
    :aria-labelledby="hideTitle ? undefined : 'review-h'"
    :aria-label="hideTitle ? t('review.title') : undefined"
  >
    <div class="flex flex-col gap-3">
      <div v-if="!hideTitle || card" class="flex items-center gap-2.5">
        <h2 v-if="!hideTitle" id="review-h" class="text-lg font-semibold">
          {{ t('review.title') }}
        </h2>
        <div class="flex-1" />
        <span v-if="card" class="text-[13.5px] text-(--omb-text-muted)">
          {{ t('review.cardOf', { i: index + 1, n: total }) }}
        </span>
      </div>
      <div v-if="total" aria-hidden="true" class="flex gap-1.5">
        <span
          v-for="b in bars"
          :key="b"
          class="h-1 flex-1 rounded-full"
          :class="b - 1 <= index ? 'bg-(--omb-accent)' : 'bg-(--omb-border)'"
        />
      </div>
    </div>

    <template v-if="card">
      <article
        class="flex min-h-[300px] flex-col gap-[22px] rounded-3xl bg-(--omb-surface) px-6 py-8 shadow-(--omb-shadow-lift) md:px-12 md:py-11"
      >
        <span class="text-[13.5px] text-(--omb-text-muted)">
          {{ t('review.saved', { when: fmt.relative(card.item.capturedAt) }) }} ·
          {{ t(`review.from.${card.item.kind}`) }}
        </span>
        <div v-if="heading" class="font-semibold">{{ heading }}</div>
        <p
          class="m-0 font-(family-name:--font-quote) text-[22px] leading-[1.45] break-words whitespace-pre-line text-(--omb-quote-text) md:text-[27px]"
        >
          <template v-if="card.item.quote">“{{ text }}”</template>
          <template v-else>{{ text }}</template>
        </p>
        <span class="flex-1" />
        <div v-if="card.item.tags.length" class="flex flex-wrap gap-2">
          <span v-for="tag in card.item.tags" :key="tag.name" class="omb-chip omb-chip-tag">
            {{ tag.name }}
          </span>
        </div>
      </article>
      <div class="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          :disabled="busy"
          class="omb-btn h-12 px-6 text-[15px]"
          @click="answer(false)"
        >
          {{ t('review.forgot') }}
        </button>
        <button
          type="button"
          :disabled="busy"
          class="omb-btn omb-btn-primary h-12 px-6 text-[15px]"
          @click="answer(true)"
        >
          {{ nextDays ? t('review.gotIt', { n: nextDays }) : t('review.gotItLast') }}
        </button>
      </div>
      <span class="flex items-center gap-1.5 self-center text-[13.5px] text-(--omb-text-muted)">
        <span class="omb-kbd">F</span> {{ t('review.keyForgot') }}
        <span class="omb-kbd ml-2">G</span> {{ t('review.keyGotIt') }}
      </span>
    </template>

    <div
      v-else
      class="flex flex-col gap-1 rounded-3xl bg-(--omb-surface) px-8 py-10 text-center shadow-(--omb-shadow)"
    >
      <span class="text-lg font-semibold">{{
        total ? t('review.finishedTitle') : t('review.emptyTitle')
      }}</span>
      <span class="text-sm text-(--omb-text-muted)">{{
        total ? t('review.finishedBody') : t('review.emptyBody')
      }}</span>
    </div>
  </section>
</template>
