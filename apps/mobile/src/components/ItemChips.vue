<script setup lang="ts">
import type { ItemDto } from '@omb/shared'
import { computed } from 'vue'
import { formatter } from '../lib/format'

/** Reminder chips (amber dot), then tags (grey; dashed with a "?" when the AI suggested them). */
const props = withDefaults(defineProps<{ item: ItemDto; small?: boolean }>(), { small: true })

const reminders = computed(() =>
  props.item.reminders.filter((r) => r.status === 'ACTIVE' || r.status === 'FIRED'),
)
</script>

<template>
  <div v-if="reminders.length || item.tags.length" class="chips">
    <span
      v-for="r in reminders"
      :key="r.id"
      class="omb-chip omb-chip-rem"
      :class="{ 'omb-chip-sm': small, 'omb-chip-ai': r.isAiSuggested }"
    >
      {{ formatter.reminder(r) }}
    </span>
    <span
      v-for="tag in item.tags"
      :key="tag.name"
      class="omb-chip"
      :class="[tag.suggested ? 'omb-chip-ai' : 'omb-chip-tag', { 'omb-chip-sm': small }]"
    >
      {{ tag.name }}{{ tag.suggested ? '?' : '' }}
    </span>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
