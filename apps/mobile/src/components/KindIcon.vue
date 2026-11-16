<script setup lang="ts">
import type { ItemKind } from '@omb/shared'
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{ kind: ItemKind; size?: number }>(), { size: 32 })

/** Each kind keeps its own tint: yellow highlight, green voice, violet image, blue link. */
const look = computed(
  () =>
    ({
      TEXT: { icon: 'text', bg: 'var(--omb-kind-bg)', fg: 'var(--omb-kind-text)' },
      LINK: { icon: 'link', bg: 'var(--omb-link-bg)', fg: 'var(--omb-link-text)' },
      HIGHLIGHT: {
        icon: 'highlight',
        bg: 'var(--omb-highlight-bg)',
        fg: 'var(--omb-highlight-text)',
      },
      VOICE: { icon: 'mic', bg: 'var(--omb-voice-bg)', fg: 'var(--omb-voice-text)' },
      IMAGE: { icon: 'image', bg: 'var(--omb-image-bg)', fg: 'var(--omb-image-text)' },
    })[props.kind] as { icon: 'text'; bg: string; fg: string },
)
</script>

<template>
  <span
    class="kind"
    :style="{
      width: `${props.size}px`,
      height: `${props.size}px`,
      background: look.bg,
      color: look.fg,
    }"
  >
    <AppIcon :name="look.icon" :size="Math.round(props.size / 2)" />
  </span>
</template>

<style scoped>
.kind {
  flex: none;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
