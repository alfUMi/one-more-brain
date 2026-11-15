<script setup lang="ts">
defineProps<{ title: string; hint?: string }>()
</script>

<template>
  <header class="flex flex-col gap-1">
    <h2 class="text-[28px] font-bold">{{ title }}</h2>
    <p v-if="hint" class="m-0 text-sm text-(--omb-text-muted)">{{ hint }}</p>
  </header>
</template>
