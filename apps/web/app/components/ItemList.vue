<script setup lang="ts">
import type { ItemDto } from '@omb/shared'

const props = defineProps<{
  /** Inbox styling for the toolbar. */
  triage?: boolean
  keepsItem?: (item: ItemDto) => boolean
}>()
const emit = defineEmits<{ change: [] }>()
const items = defineModel<ItemDto[]>({ required: true })

const actions = useItemActions(items, {
  keepsItem: props.keepsItem,
  onChange: () => emit('change'),
})

type Panel = 'editing' | 'tagging' | 'remind'

const selectedId = ref<string | null>(null)
/** Which item has its editor, tag input or remind popover open. */
const panels = reactive<Record<Panel, string | null>>({
  editing: null,
  tagging: null,
  remind: null,
})

function setPanel(panel: Panel, itemId: string, on: boolean) {
  if (on) panels[panel] = itemId
  else if (panels[panel] === itemId) panels[panel] = null
}

const selectedIndex = computed(() => items.value.findIndex((i) => i.id === selectedId.value))
const selected = computed(() => items.value[selectedIndex.value] ?? null)

// Keep a selection while the list changes: the item that took the removed one's place.
let lastIndex = 0
watch(selectedIndex, (i) => i >= 0 && (lastIndex = i))
watch(
  () => items.value.map((i) => i.id).join(),
  () => {
    if (selected.value || !items.value.length) return
    if (selectedId.value) {
      selectedId.value = items.value[Math.min(lastIndex, items.value.length - 1)]!.id
    }
  },
)

function move(delta: number) {
  if (!items.value.length) return
  const next = selectedIndex.value === -1 ? 0 : selectedIndex.value + delta
  const item = items.value[Math.max(0, Math.min(items.value.length - 1, next))]!
  selectedId.value = item.id
  nextTick(() => document.getElementById(`item-${item.id}`)?.scrollIntoView({ block: 'nearest' }))
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return Boolean(el?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
}

function onKeydown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
  if (e.key === 'ArrowDown' || e.key === 'j') return void (e.preventDefault(), move(1))
  if (e.key === 'ArrowUp') return void (e.preventDefault(), move(-1))
  const item = selected.value
  if (!item) return
  const handlers: Record<string, () => void> = {
    e: () => setPanel('editing', item.id, true),
    '#': () => setPanel('tagging', item.id, true),
    r: () => setPanel('remind', item.id, true),
    m: () => void actions.remember(item),
    k: () => item.status !== 'KEPT' && void actions.setStatus(item, 'KEPT'),
    a: () => item.status !== 'ARCHIVED' && void actions.setStatus(item, 'ARCHIVED'),
    d: () => item.status !== 'DONE' && void actions.setStatus(item, 'DONE'),
  }
  const handler = handlers[e.key.toLowerCase()] ?? handlers[e.key]
  if (handler) {
    e.preventDefault()
    handler()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

/** Selects the first item (used after the first load). */
function selectFirst() {
  if (!selected.value && items.value[0]) selectedId.value = items.value[0].id
}
defineExpose({ selectFirst })
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <ItemCard
      v-for="item in items"
      :id="`item-${item.id}`"
      :key="item.id"
      :item="item"
      :triage="triage"
      :selected="item.id === selectedId"
      :editing="panels.editing === item.id"
      :tagging="panels.tagging === item.id"
      :remind-open="panels.remind === item.id"
      @update:editing="setPanel('editing', item.id, $event)"
      @update:tagging="setPanel('tagging', item.id, $event)"
      @update:remind-open="setPanel('remind', item.id, $event)"
      @select="selectedId = item.id"
      @status="actions.setStatus(item, $event)"
      @remember="actions.remember(item)"
      @remind="actions.remind(item, $event)"
      @accept-reminder="actions.acceptReminder(item, $event)"
      @remove-reminder="actions.removeReminder(item, $event)"
      @save-body="actions.saveBody(item, $event)"
      @add-tag="actions.addTag(item, $event)"
      @delete="actions.remove(item)"
    />
  </div>
</template>
