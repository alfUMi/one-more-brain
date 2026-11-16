<script setup lang="ts">
import { IonDatetime, modalController } from '@ionic/vue'
import { parseCapture } from '@omb/shared'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RemindChoice } from '../lib/actions'
import { formatter } from '../lib/format'
import { remindPresets } from '../lib/remind'
import AppIcon from './AppIcon.vue'

/** Mockup: Mobile · Remind sheet. */
const { t, locale } = useI18n()
const typed = ref('')
const picking = ref(false)
const picked = ref<string | null>(null)

const zone = computed(() => formatter.value.timeZone)
const presets = computed(() => remindPresets(zone.value))

const parsed = computed(() =>
  typed.value.trim()
    ? parseCapture(typed.value, { now: new Date(), timeZone: zone.value }).reminder
    : null,
)

/** What "Set reminder" applies: the typed phrase, else the picked date. */
const choice = computed<RemindChoice | null>(() => {
  if (parsed.value) {
    return { kind: parsed.value.kind, fireAt: parsed.value.fireAt, rrule: parsed.value.rrule }
  }
  if (picked.value) return { kind: 'TIME', fireAt: new Date(picked.value) }
  return null
})

function pick(value: RemindChoice) {
  void modalController.dismiss(value, 'pick')
}

const nowIso = new Date().toISOString()
</script>

<template>
  <div class="ion-page">
    <div class="sheet-body">
      <div class="head">
        <span class="badge"><AppIcon name="clock" :size="18" :stroke="1.9" /></span>
        <h2>{{ t('mobile.remind.title') }}</h2>
      </div>

      <label class="omb-label">
        {{ t('mobile.remind.typeTime') }}
        <input
          v-model="typed"
          class="omb-input"
          :placeholder="t('reminder.customPlaceholder')"
          enterkeyhint="done"
          @keydown.enter.prevent="choice && pick(choice)"
        />
      </label>
      <span v-if="parsed" class="omb-chip omb-chip-rem parsed">
        <AppIcon
          :name="parsed.kind === 'RECURRING' ? 'repeat' : 'clock'"
          :size="14"
          :stroke="2.2"
        />
        {{ formatter.reminder(parsed) }}
        <template v-if="parsed.kind === 'RECURRING'">
          · {{ t('mobile.remind.next', { when: formatter.when(parsed.fireAt) }) }}
        </template>
      </span>
      <p v-else-if="typed.trim()" class="omb-hint">{{ t('reminder.notUnderstood') }}</p>

      <div class="options">
        <button
          v-for="p in presets"
          :key="p.key"
          type="button"
          class="opt"
          @click="pick({ kind: 'TIME', fireAt: p.at })"
        >
          {{ t(`mobile.remind.${p.key}`) }}
          <span class="when">{{ formatter.when(p.at) }}</span>
        </button>
        <button type="button" class="opt" @click="picking = !picking">
          {{ t('mobile.remind.pick') }}
          <AppIcon class="when" :name="picking ? 'chevron-down' : 'chevron-right'" :size="18" />
        </button>
        <IonDatetime
          v-if="picking"
          v-model="picked"
          presentation="date-time"
          :min="nowIso"
          :locale="locale"
          :first-day-of-week="1"
          hour-cycle="h23"
          class="picker"
        />
        <button type="button" class="opt" disabled>
          <AppIcon name="pin" :size="18" />
          {{ t('mobile.remind.place') }}
          <span class="when soon">{{ t('mobile.remind.placeSoon') }}</span>
        </button>
      </div>

      <button
        type="button"
        class="omb-btn omb-btn-primary"
        :disabled="!choice"
        @click="choice && pick(choice)"
      >
        {{ t('mobile.remind.set') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.head h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.badge {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: var(--omb-rem-bg);
  color: var(--omb-rem-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.parsed {
  align-self: flex-start;
}
.opt {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  padding: 0 4px;
  border: 0;
  border-top: 1px solid var(--omb-border-muted);
  background: transparent;
  font: 500 16px var(--ion-font-family);
  color: var(--omb-text);
  text-align: left;
}
.opt:disabled {
  color: var(--omb-text-muted);
}
.when {
  margin-left: auto;
  font-size: 14px;
  color: var(--omb-text-muted);
}
.soon {
  font-size: 12.5px;
}
.picker {
  --background: var(--omb-surface);
  width: 100%;
  max-width: 100%;
}
</style>
