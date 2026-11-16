<script setup lang="ts">
import { alertController } from '@ionic/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsShell from '../../components/settings/SettingsShell.vue'
import { disablePush } from '../../lib/push'
import { session, signOut, updateProfile } from '../../lib/session'
import { saveFailed, toast } from '../../lib/toast'

/** Settings › Account: the real profile (name is editable; email is how you sign in). */
const { t } = useI18n()

const name = ref(session.profile?.name ?? '')
watch(
  () => session.profile?.name,
  (value) => (name.value = value ?? ''),
)

async function saveName() {
  const value = name.value.trim()
  if (value === (session.profile?.name ?? '')) return
  if (await updateProfile({ name: value })) void toast(t('settings.saved'))
  else void saveFailed()
}

async function confirmSignOut() {
  const alert = await alertController.create({
    header: t('mobile.settings.signOutConfirm'),
    message: t('mobile.settings.signOutHint'),
    buttons: [
      { text: t('actions.cancel'), role: 'cancel' },
      { text: t('settings.signOut'), role: 'destructive' },
    ],
  })
  await alert.present()
  const { role } = await alert.onDidDismiss()
  if (role !== 'destructive') return
  await disablePush({ remember: false })
  await signOut()
}
</script>

<template>
  <SettingsShell
    :title="t('settings.sections.account')"
    :back="t('settings.title')"
    back-to="/settings"
  >
    <div class="group pad">
      <label class="omb-label">
        {{ t('settings.name') }}
        <input
          v-model="name"
          class="omb-input"
          :placeholder="t('settings.namePlaceholder')"
          autocomplete="name"
          enterkeyhint="done"
          maxlength="100"
          @blur="saveName"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        />
      </label>
      <div class="field">
        <span class="label">{{ t('settings.email') }}</span>
        <span>{{ session.profile?.email }}</span>
        <span class="omb-hint">{{ t('settings.emailHint') }}</span>
      </div>
    </div>

    <div class="group pad">
      <div class="field">
        <span class="label">{{ t('settings.signOut') }}</span>
        <span class="omb-hint">{{ t('mobile.settings.signOutHint') }}</span>
      </div>
      <button type="button" class="omb-btn omb-btn-danger" @click="confirmSignOut">
        {{ t('settings.signOut') }}
      </button>
    </div>
  </SettingsShell>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 15px;
  border-top: 1px solid var(--omb-border-muted);
  padding-top: 12px;
}
.group.pad > .field:first-child {
  border-top: 0;
  padding-top: 0;
}
.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--omb-text-toned);
}
</style>
