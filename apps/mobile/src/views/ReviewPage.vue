<script setup lang="ts">
import { IonContent, IonPage, onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import { REVIEW_INTERVALS_DAYS, type ReviewCardDto } from '@omb/shared'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { tap } from '../lib/actions'
import { formatter } from '../lib/format'
import { api } from '../lib/session'
import { loadToday, store } from '../lib/store'
import { saveFailed } from '../lib/toast'

/** Mockup: Mobile · Review. A tab of its own, and also opened from Today. */
const { t } = useI18n()
const route = useRoute()
/** On the tab there is nowhere to go back to. */
const asTab = computed(() => route.path.startsWith('/tabs/'))
const ionRouter = useIonRouter()

/** The deck is fixed when the screen opens, so answering doesn't reshuffle it. */
const cards = ref<ReviewCardDto[]>([])
const index = ref(0)
const busy = ref(false)

onIonViewWillEnter(async () => {
  await loadToday()
  cards.value = [...(store.today?.reviews ?? [])]
  index.value = 0
})

const card = computed(() => cards.value[index.value] ?? null)
const total = computed(() => cards.value.length)
const text = computed(() => {
  const i = card.value?.item
  if (!i) return ''
  return i.quote ?? i.body ?? i.title ?? i.extractedText ?? i.pageTitle ?? i.url ?? ''
})
const heading = computed(() => {
  const i = card.value?.item
  return i?.title && i.title !== text.value ? i.title : null
})
const nextDays = computed(() => {
  const step = card.value?.step ?? 0
  return step + 1 < REVIEW_INTERVALS_DAYS.length ? REVIEW_INTERVALS_DAYS[step + 1] : null
})
const image = computed(
  () => card.value?.item.attachments.find((a) => a.kind !== 'AUDIO')?.url ?? null,
)

async function answer(gotIt: boolean) {
  if (!card.value || busy.value) return
  busy.value = true
  try {
    await api.answerReview(card.value.item.id, gotIt)
    tap()
    index.value += 1
    if (index.value >= total.value) void loadToday()
  } catch {
    void saveFailed()
  } finally {
    busy.value = false
  }
}

/** "Forgot · again tomorrow" → a main line and a small line, as on the mockup buttons. */
function split(label: string) {
  const [main, ...rest] = label.split(' · ')
  return { main, sub: rest.join(' · ') }
}
const forgotLabel = computed(() => split(t('review.forgot')))
const gotItLabel = computed(() =>
  split(nextDays.value ? t('review.gotIt', { n: nextDays.value }) : t('review.gotItLast')),
)

function back() {
  if (ionRouter.canGoBack()) ionRouter.back()
  else ionRouter.navigate('/tabs/today', 'back', 'replace')
}
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="page">
        <button v-if="!asTab" type="button" class="omb-back back" @click="back">
          <AppIcon name="chevron-left" :stroke="2" />{{ t('mobile.review.back') }}
        </button>
        <header class="omb-header head" :class="{ 'after-back': !asTab }">
          <h1>{{ t('review.title') }}</h1>
          <div class="grow" />
          <span v-if="card" class="meta">{{ t('review.cardOf', { i: index + 1, n: total }) }}</span>
        </header>
        <div v-if="total" class="bars" aria-hidden="true">
          <span v-for="b in total" :key="b" :class="{ on: b - 1 <= index }" />
        </div>

        <main class="main">
          <article v-if="card" class="card">
            <span class="meta-line">
              {{ t('review.saved', { when: formatter.relative(card.item.capturedAt) }) }} ·
              {{ t(`review.from.${card.item.kind}`) }}
            </span>
            <h2 v-if="heading" class="heading">{{ heading }}</h2>
            <p class="text" :class="{ quote: card.item.quote }">
              <template v-if="card.item.quote">“{{ text }}”</template>
              <template v-else>{{ text }}</template>
            </p>
            <img v-if="image" :src="image" alt="" class="image" />
            <div class="grow" />
            <div v-if="card.item.tags.length" class="chips">
              <span v-for="tag in card.item.tags" :key="tag.name" class="omb-chip omb-chip-tag">
                {{ tag.name }}
              </span>
            </div>
          </article>
          <div v-else class="omb-empty">
            <h2>{{ total ? t('review.finishedTitle') : t('review.emptyTitle') }}</h2>
            <p>{{ total ? t('review.finishedBody') : t('review.emptyBody') }}</p>
            <button v-if="!asTab" type="button" class="omb-btn" @click="back">
              {{ t('mobile.review.backToToday') }}
            </button>
          </div>
        </main>

        <div v-if="card" class="answers">
          <button type="button" class="answer forgot" :disabled="busy" @click="answer(false)">
            {{ forgotLabel.main }}
            <span v-if="forgotLabel.sub" class="answer-sub">{{ forgotLabel.sub }}</span>
          </button>
          <button type="button" class="answer got" :disabled="busy" @click="answer(true)">
            {{ gotItLabel.main }}
            <span v-if="gotItLabel.sub" class="answer-sub">{{ gotItLabel.sub }}</span>
          </button>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
.back {
  align-self: flex-start;
  margin: calc(var(--ion-safe-area-top, 0px) + 8px) 0 0 12px;
}
.head {
  padding-bottom: 14px;
}
.head.after-back {
  padding-top: 4px;
}
.meta {
  font-size: 14px;
  color: var(--omb-text-muted);
}
.bars {
  display: flex;
  gap: 5px;
  padding: 0 22px;
}
.bars span {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--omb-border);
}
.bars span.on {
  background: var(--omb-accent);
}
.main {
  flex-grow: 1;
  padding: 22px 16px 18px;
  display: flex;
  flex-direction: column;
}
.card {
  flex-grow: 1;
  max-height: 520px;
  min-height: 280px;
  background: var(--omb-surface);
  border-radius: 26px;
  box-shadow: var(--omb-shadow-lg);
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: auto;
}
.meta-line {
  font-size: 13px;
  color: var(--omb-text-muted);
}
.heading {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.text {
  margin: 0;
  font-size: 22px;
  line-height: 1.4;
  font-weight: 500;
  letter-spacing: -0.015em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.text.quote {
  font-family: var(--omb-quote-font);
  font-size: 23px;
  line-height: 1.45;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--omb-quote-text);
}
.image {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 16px;
}
.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.answers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 0 16px calc(var(--ion-safe-area-bottom, 0px) + 16px);
}
.answer {
  min-height: 52px;
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  font: 500 15px var(--ion-font-family);
}
.answer:disabled {
  opacity: 0.5;
}
.answer.forgot {
  background: var(--omb-hover);
  color: var(--omb-text);
}
.answer.got {
  background: var(--omb-accent);
  color: var(--omb-on-accent);
  font-weight: 600;
}
.answer-sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--omb-text-muted);
}
.answer.got .answer-sub {
  color: var(--omb-on-accent);
  opacity: 0.7;
}
</style>
