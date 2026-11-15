<script setup lang="ts">
import type { ReviewCardDto, ReviewScheduleDto } from '@omb/shared'

const { t } = useI18n()
useHead({ title: () => t('review.title') })

const api = useItemsApi()
const fmt = useFormat()
const sidebar = useSidebar()
const cards = ref<ReviewCardDto[] | null>(null)
const schedule = ref<ReviewScheduleDto | null>(null)

async function loadSchedule() {
  schedule.value = await $fetch<ReviewScheduleDto>('/api/v1/reviews/schedule').catch(
    () => schedule.value,
  )
}
onMounted(async () => {
  cards.value = (await api.today().catch(() => null))?.reviews ?? []
  await loadSchedule()
})
function onAnswered() {
  void sidebar.refresh()
  void loadSchedule()
}

const buckets = computed(() =>
  schedule.value
    ? [
        { label: t('review.tomorrow'), n: schedule.value.dueTomorrow },
        { label: t('review.thisWeek'), n: schedule.value.dueThisWeek },
        { label: t('review.later'), n: schedule.value.dueLater },
      ]
    : [],
)
</script>

<template>
  <!-- Same structure as the Inbox and Today: a main column and a fixed side column. -->
  <div class="flex flex-wrap items-start gap-7">
    <section class="flex max-w-[820px] min-w-0 flex-[999_1_520px] flex-col gap-[22px]">
      <header class="flex items-baseline gap-3">
        <h1 class="text-[30px] font-bold">{{ t('review.title') }}</h1>
      </header>
      <ReviewDeck v-if="cards" :cards="cards" hide-title @answered="onAnswered" />
    </section>

    <aside
      :aria-label="t('review.comingUp')"
      class="flex max-w-[360px] min-w-0 flex-[1_1_280px] flex-col gap-3.5"
    >
      <div class="omb-side">
        <h2 class="text-base font-semibold">{{ t('review.comingUp') }}</h2>
        <dl v-if="schedule" class="m-0 flex flex-col">
          <div
            v-for="b in buckets"
            :key="b.label"
            class="flex items-baseline justify-between border-t border-(--omb-border-muted) py-2 first:border-t-0 first:pt-0"
          >
            <dt class="text-sm text-(--omb-text-toned)">{{ b.label }}</dt>
            <dd class="font-display m-0 text-lg font-semibold tabular-nums">{{ b.n }}</dd>
          </div>
        </dl>
        <template v-if="schedule?.upcoming.length">
          <div
            v-for="u in schedule.upcoming"
            :key="u.itemId"
            class="flex items-start gap-3 border-t border-(--omb-border-muted) pt-2.5"
          >
            <span class="w-[72px] flex-none text-[13px] font-semibold text-(--omb-accent)">
              {{ fmt.relative(u.nextAt) }}
            </span>
            <span class="line-clamp-2 min-w-0 text-sm break-words">{{ u.text }}</span>
          </div>
        </template>
        <p v-else-if="schedule" class="omb-meta m-0">{{ t('review.nothingScheduled') }}</p>
        <p v-if="schedule" class="omb-meta m-0 border-t border-(--omb-border-muted) pt-2.5">
          {{ t('review.stats', { n: schedule.inReview, m: schedule.learned }) }}
        </p>
      </div>

      <div class="omb-side gap-2!">
        <h2 class="text-base font-semibold">{{ t('review.howItWorks') }}</h2>
        <p class="m-0 text-sm leading-normal text-(--omb-text-toned)">{{ t('review.howBody') }}</p>
      </div>
    </aside>
  </div>
</template>
