<script setup lang="ts">
/** Asks once to turn on notifications, so reminders arrive while the tab is closed. */
const { t } = useI18n()
const toast = useToast()
const push = usePush()

const DISMISS_KEY = 'omb-push-prompt-dismissed'
const dismissed = ref(true)
onMounted(() => {
  try {
    dismissed.value = localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    dismissed.value = false
  }
})

const visible = computed(() => push.permission.value === 'default' && !dismissed.value)
const busy = ref(false)

async function enable() {
  busy.value = true
  try {
    const on = await push.enable()
    toast.add(
      on
        ? { title: t('push.enabled'), color: 'success' }
        : { title: t('push.failed'), color: 'warning' },
    )
  } catch {
    toast.add({ title: t('push.failed'), color: 'error' })
  } finally {
    busy.value = false
  }
}

function later() {
  dismissed.value = true
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // Private mode: the prompt just comes back next time.
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="flex flex-wrap items-center gap-3 rounded-[18px] bg-(--omb-surface) px-5 py-3.5 shadow-(--omb-shadow)"
  >
    <span
      class="flex size-9 flex-none items-center justify-center rounded-full bg-(--omb-rem-bg) text-(--omb-rem-text)"
    >
      <UIcon name="i-lucide-bell" class="size-[18px]" />
    </span>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold">{{ t('push.title') }}</p>
      <p class="text-[13px] text-(--omb-text-muted)">{{ t('push.body') }}</p>
    </div>
    <div class="flex gap-2">
      <UButton color="neutral" variant="ghost" @click="later">{{ t('push.later') }}</UButton>
      <UButton :loading="busy" @click="enable">{{ t('push.enable') }}</UButton>
    </div>
  </div>
</template>
