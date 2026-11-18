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
      <h2 class="head">{{ t('mobile.remind.title') }}</h2>

      <label class="typed">
        <input
          v-model="typed"
          :placeholder="t('reminder.customPlaceholder')"
          :aria-label="t('mobile.remind.typeTime')"
          enterkeyhint="done"
          @keydown.enter.prevent="choice && pick(choice)"
        />
        <span v-if="parsed" class="parsed">
          <span class="omb-rem-dot" />
          {{ formatter.reminder(parsed) }}
          <template v-if="parsed.kind === 'RECURRING'">
            · {{ t('mobile.remind.next', { when: formatter.when(parsed.fireAt) }) }}
          </template>
        </span>
        <span v-else-if="typed.trim()" class="omb-hint">{{ t('reminder.notUnderstood') }}</span>
      </label>

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
        <button type="button" class="opt" :aria-expanded="picking" @click="picking = !picking">
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
          {{ t('mobile.remind.place') }}
          <span class="when soon">{{ t('mobile.remind.placeSoon') }}</span>
        </button>
      </div>

      <button
        type="button"
        class="omb-btn omb-btn-primary set"
        :disabled="!choice"
        @click="choice && pick(choice)"
      >
        {{ t('mobile.remind.set') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.sheet-body {
  gap: 4px !important;
  padding-left: 12px !important;
  padding-right: 12px !important;
}
.head {
  margin: 0;
  padding: 0 16px 10px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.015em;
}
.typed {
  margin: 0 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 16px;
  background: var(--omb-surface-muted);
}
.typed input {
  border: 0;
  outline: 0;
  padding: 0;
  background: transparent;
  font: 400 16px var(--ion-font-family);
  color: var(--omb-text);
}
.typed input::placeholder {
  color: var(--omb-text-faint);
}
.parsed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--omb-rem-text);
}
.opt {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 54px;
  padding: 0 16px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  font: 400 16px var(--ion-font-family);
  color: var(--omb-text);
  text-align: left;
}
.opt:active:not(:disabled) {
  background: var(--omb-surface-muted);
}
.opt:disabled {
  opacity: 1;
  color: var(--omb-text-faint);
}
.when {
  margin-left: auto;
  font-size: 14px;
  color: var(--omb-text-muted);
  font-variant-numeric: tabular-nums;
}
.soon {
  font-size: 12.5px;
}
.picker {
  --background: var(--omb-surface);
  width: 100%;
  max-width: 100%;
}
.set {
  margin: 10px 4px 0;
  min-height: 52px;
  font-size: 15.5px;
}
</style>
