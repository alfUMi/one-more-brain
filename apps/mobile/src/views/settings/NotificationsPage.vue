<script setup lang="ts">
import { IonToggle, onIonViewWillEnter } from '@ionic/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsShell from '../../components/settings/SettingsShell.vue'
import {
  disableNotifications,
  enableNotifications,
  fixExactAlarms,
  notifications,
  syncNotifications,
} from '../../lib/notifications'
import { toast } from '../../lib/toast'

/** Settings › Notifications: reminders and the digest scheduled on this phone. */
const { t } = useI18n()
const busy = ref(false)

onIonViewWillEnter(() => void syncNotifications())

const text = computed(() => {
  switch (notifications.status) {
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
      if (!(await enableNotifications())) void toast(text.value)
    } else await disableNotifications()
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
          :checked="notifications.status === 'on'"
          :disabled="busy || notifications.status === 'unavailable'"
          justify="space-between"
          class="toggle"
          @ion-change="toggle"
        >
          {{ t('mobile.settings.pushThisPhone') }}
        </IonToggle>
      </div>
    </div>
    <p class="omb-hint note" role="status">{{ text }}</p>
    <template v-if="notifications.status === 'on' && !notifications.exact">
      <p class="omb-hint note">{{ t('mobile.settings.exactOff') }}</p>
      <button type="button" class="omb-btn" @click="fixExactAlarms">
        {{ t('mobile.settings.exactFix') }}
      </button>
    </template>
    <p class="omb-hint note">{{ t('mobile.settings.pushSync') }}</p>
  </SettingsShell>
</template>

<style scoped>
.toggle {
  width: 100%;
  --track-background-checked: var(--omb-accent);
  font: 500 15px var(--ion-font-family);
}
</style>
