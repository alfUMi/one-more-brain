<script setup lang="ts">
import { IonToggle, onIonViewWillEnter } from '@ionic/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsShell from '../../components/settings/SettingsShell.vue'
import { disablePush, enablePush, push, syncPush } from '../../lib/push'
import { toast } from '../../lib/toast'

/** Settings › Notifications: push on this phone. */
const { t } = useI18n()
const busy = ref(false)

onIonViewWillEnter(() => void syncPush())

const text = computed(() => {
  switch (push.status) {
    case 'on':
      return t('mobile.settings.pushOn')
    case 'denied':
      return t('mobile.settings.pushDenied')
    case 'unavailable':
      return t('mobile.settings.pushUnavailable')
    default:
      return t('mobile.settings.pushOff')
  }
})

async function toggle(event: CustomEvent<{ checked: boolean }>) {
  busy.value = true
  try {
    if (event.detail.checked) {
      if (!(await enablePush())) void toast(text.value)
    } else await disablePush()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SettingsShell
    :title="t('settings.sections.notifications')"
    :back="t('settings.title')"
    back-to="/settings"
  >
    <div class="group">
      <div class="row">
        <IonToggle
          :checked="push.status === 'on'"
          :disabled="busy || push.status === 'unavailable'"
          justify="space-between"
          class="toggle"
          @ion-change="toggle"
        >
          {{ t('mobile.settings.pushThisPhone') }}
        </IonToggle>
      </div>
    </div>
    <p class="omb-hint note" role="status">{{ text }}</p>
    <p class="omb-hint note">{{ t('settings.digestChannels') }}</p>
  </SettingsShell>
</template>

<style scoped>
.toggle {
  width: 100%;
  --track-background-checked: var(--omb-accent);
  font: 500 15px var(--ion-font-family);
}
</style>
