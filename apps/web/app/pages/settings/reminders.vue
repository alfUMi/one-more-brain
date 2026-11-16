<script setup lang="ts">
definePageMeta({ layout: 'settings' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.sections.reminders')} · ${t('settings.title')}` })

const { user, save } = useProfile()
const time = ref(user.value?.digestTime ?? '08:00')
watch(
  () => user.value?.digestTime,
  (v) => v && (time.value = v),
)
const toast = useToast()
const testing = ref(false)
async function sendTest() {
  testing.value = true
  try {
    const { channels } = await $fetch<{ channels: number }>('/api/v1/digest/test', {
      method: 'POST',
    })
    if (channels) toast.add({ title: t('settings.digestTestSent'), color: 'success' })
    else toast.add({ title: t('settings.digestTestNoDevices'), color: 'warning' })
  } catch {
    toast.add({ title: t('settings.digestTestFailed'), color: 'error' })
  } finally {
    testing.value = false
  }
}

function saveTime() {
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(time.value) && time.value !== user.value?.digestTime) {
    void save({ digestTime: time.value })
  }
}
</script>

<template>
  <div class="flex max-w-[680px] flex-col gap-[18px]">
    <SettingsHeader :title="t('settings.sections.reminders')" :hint="t('settings.synced')" />

    <section class="omb-card" aria-labelledby="digest-h">
      <div class="flex flex-col gap-1">
        <h3 id="digest-h" class="text-sm font-semibold">{{ t('settings.digest') }}</h3>
        <span class="omb-hint">{{ t('settings.digestHint') }}</span>
      </div>
      <div class="flex flex-wrap items-center gap-6">
        <label class="flex cursor-pointer items-center gap-3">
          <USwitch
            :model-value="user?.digestEnabled ?? true"
            @update:model-value="save({ digestEnabled: $event })"
          />
          <span class="text-sm font-medium">{{ t('settings.digestOn') }}</span>
        </label>
        <label class="flex items-center gap-3">
          <span class="text-sm font-medium">{{ t('settings.digestTime') }}</span>
          <input
            v-model="time"
            type="time"
            :disabled="!user?.digestEnabled"
            class="h-9 rounded-lg border border-(--omb-border) bg-(--omb-surface) px-2.5 text-sm disabled:opacity-50"
            @change="saveTime"
          />
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-3 border-t border-(--omb-border-muted) pt-4">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-send"
          :loading="testing"
          @click="sendTest"
        >
          {{ t('settings.digestTest') }}
        </UButton>
        <span class="omb-hint">{{ t('settings.digestChannels') }}</span>
      </div>
    </section>

    <section class="omb-card gap-1!" aria-labelledby="defaults-h">
      <h3 id="defaults-h" class="text-sm font-semibold">{{ t('settings.defaults') }}</h3>
      <p class="omb-hint m-0">{{ t('settings.defaultsHint') }}</p>
    </section>
  </div>
</template>
