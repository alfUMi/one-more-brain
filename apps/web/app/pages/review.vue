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
  <section class="mx-auto flex w-full max-w-[680px] flex-col gap-7">
    <header class="flex flex-col gap-1.5">
      <h1 class="text-[36px] leading-tight font-semibold">{{ t('review.title') }}</h1>
      <span class="text-[15px] text-(--omb-text-muted)">{{ t('review.subtitle') }}</span>
    </header>
    <ReviewDeck v-if="cards" :cards="cards" hide-title @answered="sidebar.refresh" />
  </section>
</template>
