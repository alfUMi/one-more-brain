<script setup lang="ts">
import { IonContent, IonPage, onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import { REVIEW_INTERVALS_DAYS, type ReviewCardDto } from '@omb/shared'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '../components/AppIcon.vue'
import { tap } from '../lib/actions'
import { formatter } from '../lib/format'
import { api } from '../lib/session'
import { loadToday, store } from '../lib/store'
import { saveFailed } from '../lib/toast'

/** Mockup: Mobile · Review. Opened from Today. */
const { t } = useI18n()
const ionRouter = useIonRouter()

/** The deck is fixed when the screen opens, so answering doesn't reshuffle it. */
const cards = ref<ReviewCardDto[]>([])
const index = ref(0)
const busy = ref(false)

onIonViewWillEnter(async () => {
  if (!store.today) await loadToday()
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

function back() {
  if (ionRouter.canGoBack()) ionRouter.back()
  else ionRouter.navigate('/tabs/today', 'back', 'replace')
}
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="page">
        <header class="top">
          <button type="button" class="omb-back" @click="back">
            <AppIcon name="chevron-left" :stroke="2" />{{ t('mobile.review.back') }}
          </button>
          <div class="grow" />
          <span v-if="card" class="meta">{{ t('review.cardOf', { i: index + 1, n: total }) }}</span>
        </header>
        <div v-if="total" class="bars" aria-hidden="true">
          <span v-for="b in total" :key="b" :class="{ on: b - 1 <= index }" />
        </div>

        <main class="main">
          <h1>{{ t('review.title') }}</h1>
          <template v-if="card">
            <article class="card omb-card">
              <span class="omb-meta">
                {{ t('review.saved', { when: formatter.relative(card.item.capturedAt) }) }} ·
                {{ t(`review.from.${card.item.kind}`) }}
              </span>
              <h2 v-if="heading" class="heading">{{ heading }}</h2>
              <p class="text">
                <template v-if="card.item.quote">“{{ text }}”</template>
                <template v-else>{{ text }}</template>
              </p>
              <img v-if="image" :src="image" alt="" class="image" />
              <div class="grow" />
              <div v-if="card.item.tags.length" class="chips">
                <span v-for="tag in card.item.tags" :key="tag.name" class="omb-chip omb-chip-tag">
                  #{{ tag.name }}
                </span>
              </div>
            </article>
          </template>
          <div v-else class="omb-empty">
            <h2>{{ total ? t('review.finishedTitle') : t('review.emptyTitle') }}</h2>
            <p>{{ total ? t('review.finishedBody') : t('review.emptyBody') }}</p>
            <button type="button" class="omb-btn" @click="back">
              {{ t('mobile.review.backToToday') }}
            </button>
          </div>
        </main>

        <div v-if="card" class="answers">
          <button
            type="button"
            class="omb-btn omb-btn-primary"
            :disabled="busy"
            @click="answer(true)"
          >
            {{ nextDays ? t('review.gotIt', { n: nextDays }) : t('review.gotItLast') }}
          </button>
          <button type="button" class="omb-btn" :disabled="busy" @click="answer(false)">
            {{ t('review.forgot') }}
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
.top {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: calc(var(--ion-safe-area-top, 0px) + 8px) 12px 8px;
}
.meta {
  font-size: 14px;
  color: var(--omb-text-muted);
  padding-right: 8px;
}
.bars {
  display: flex;
  gap: 4px;
  padding: 0 20px;
}
.bars span {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--omb-border);
}
.bars span.on {
  background: var(--omb-accent);
}
.main {
  flex-grow: 1;
  padding: 20px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.main h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}
.card {
  flex-grow: 1;
  max-height: 470px;
  min-height: 260px;
  border-radius: 22px;
  padding: 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
}
.heading {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.text {
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 23px;
  line-height: 1.38;
  font-weight: 500;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.image {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 12px;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.answers {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 20px calc(var(--ion-safe-area-bottom, 0px) + 24px);
}
.answers .omb-btn {
  min-height: 54px;
}
</style>
