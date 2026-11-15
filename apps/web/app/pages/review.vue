<script setup lang="ts">
import type { ReviewCardDto } from '@omb/shared'

const { t } = useI18n()
useHead({ title: () => t('review.title') })

const api = useItemsApi()
const sidebar = useSidebar()
const cards = ref<ReviewCardDto[] | null>(null)

onMounted(async () => {
  cards.value = (await api.today().catch(() => null))?.reviews ?? []
})
</script>

<template>
  <section class="flex max-w-[720px] flex-col gap-[22px]">
    <header class="flex items-baseline gap-3">
      <h1 class="text-[30px] font-bold">{{ t('review.title') }}</h1>
    </header>
    <ReviewDeck v-if="cards" :cards="cards" @answered="sidebar.refresh" />
  </section>
</template>
