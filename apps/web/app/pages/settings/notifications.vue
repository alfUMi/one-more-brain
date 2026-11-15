<script setup lang="ts">
definePageMeta({ layout: 'settings' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.sections.notifications')} · ${t('settings.title')}` })

const toast = useToast()
const push = usePush()
const pushOn = ref(false)
const busy = ref(false)
onMounted(async () => (pushOn.value = await push.isSubscribed()))

const status = computed(() => {
  if (!push.supported) return t('settings.pushUnsupported')
  if (push.permission.value === 'denied') return t('settings.pushBlocked')
  return pushOn.value ? t('settings.pushOn') : t('settings.pushOff')
})

async function toggle(on: boolean) {
  busy.value = true
  try {
    if (on) await push.enable()
    else await push.disable()
  } catch {
    toast.add({ title: t('push.failed'), color: 'error' })
  } finally {
    pushOn.value = await push.isSubscribed()
    busy.value = false
  }
}
</script>

<template>
  <div class="flex max-w-[680px] flex-col gap-[18px]">
    <SettingsHeader :title="t('settings.sections.notifications')" />

    <section class="omb-card">
      <div class="flex items-center gap-4">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span id="push-h" class="text-sm font-semibold">{{ t('settings.pushThisDevice') }}</span>
          <span class="omb-hint">{{ status }}</span>
        </div>
        <USwitch
          :model-value="pushOn"
          :loading="busy"
          :disabled="!push.supported || push.permission.value === 'denied'"
          aria-labelledby="push-h"
          @update:model-value="toggle"
        />
      </div>
      <p class="omb-hint m-0 border-t border-(--omb-border-muted) pt-4">
        {{ t('settings.channelsHint') }}
      </p>
    </section>
  </div>
</template>
