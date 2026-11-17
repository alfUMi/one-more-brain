<script setup lang="ts">
import { IonToggle } from '@ionic/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsShell from '../../components/settings/SettingsShell.vue'
import { testDigestHere } from '../../lib/notifications'
import { api, session, updateProfile } from '../../lib/session'
import { saveFailed, toast } from '../../lib/toast'

/** Settings › Reminders & digest. */
const { t } = useI18n()

const time = ref(session.profile?.digestTime ?? '08:00')
watch(
  () => session.profile?.digestTime,
  (value) => value && (time.value = value),
)
const testing = ref(false)

async function setEnabled(event: CustomEvent<{ checked: boolean }>) {
  if (!(await updateProfile({ digestEnabled: event.detail.checked }))) void saveFailed()
}

async function saveTime() {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time.value) || time.value === session.profile?.digestTime) {
    return
  }
  if (!(await updateProfile({ digestTime: time.value }))) void saveFailed()
}

async function test() {
  testing.value = true
  try {
    // This phone shows its own; browsers with notifications on get one from the server.
    const [here, { channels }] = await Promise.all([testDigestHere(), api.testDigest()])
    void toast(here || channels ? t('settings.digestTestSent') : t('settings.digestTestNoDevices'))
  } catch {
    void toast(t('settings.digestTestFailed'), { error: true })
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <SettingsShell
    :title="t('settings.sections.reminders')"
    :back="t('settings.title')"
    back-to="/settings"
  >
    <span class="cap">{{ t('settings.digest') }}</span>
    <div class="group">
      <div class="row">
        <IonToggle
          :checked="session.profile?.digestEnabled ?? true"
          justify="space-between"
          class="toggle"
          @ion-change="setEnabled"
        >
          {{ t('settings.digestOn') }}
        </IonToggle>
      </div>
      <label class="row">
        {{ t('settings.digestTime') }}
        <input
          v-model="time"
          type="time"
          class="time"
          :disabled="!session.profile?.digestEnabled"
          @change="saveTime"
          @blur="saveTime"
        />
      </label>
    </div>
    <p class="omb-hint note">{{ t('settings.digestHint') }} {{ t('settings.digestChannels') }}</p>
    <button type="button" class="omb-btn" :disabled="testing" @click="test">
      {{ t('settings.digestTest') }}
    </button>

    <span class="cap">{{ t('settings.defaults') }}</span>
    <p class="omb-hint note">{{ t('settings.defaultsHint') }}</p>
  </SettingsShell>
</template>

<style scoped>
.toggle {
  width: 100%;
  --track-background-checked: var(--omb-accent);
  font: 500 15px var(--ion-font-family);
}
.time {
  margin-left: auto;
  border: 1px solid var(--omb-border);
  border-radius: 10px;
  padding: 6px 10px;
  background: var(--omb-surface);
  color: var(--omb-text);
  font: 600 15px var(--ion-font-family);
}
</style>
