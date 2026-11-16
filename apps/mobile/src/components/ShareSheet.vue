<script setup lang="ts">
import { IonModal } from '@ionic/vue'
import { parseCapture } from '@omb/shared'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildCapture, localItem } from '../lib/capture'
import { formatter, hostOf } from '../lib/format'
import { capture } from '../lib/outbox'
import { session } from '../lib/session'
import { incoming } from '../lib/share'
import { rememberRecent, upsertItem } from '../lib/store'
import { saveFailed, toast } from '../lib/toast'
import AppLogo from './AppLogo.vue'
import AppIcon from './AppIcon.vue'

/** Mockup: Mobile · Share sheet. Opens when another app shares into One More Brain. */
const { t } = useI18n()
const note = ref('')
const saving = ref(false)
const previews = ref<string[]>([])

const open = computed(() => incoming.value !== null)

watch(incoming, (share) => {
  note.value = ''
  previews.value.forEach((u) => URL.revokeObjectURL(u))
  previews.value = share?.images.map((b) => URL.createObjectURL(b)) ?? []
})
onBeforeUnmount(() => previews.value.forEach((u) => URL.revokeObjectURL(u)))

/** Shared text that isn't just the link becomes part of the note. */
const sharedText = computed(() => {
  const share = incoming.value
  if (!share) return ''
  return share.url ? share.text.replace(share.url, '').trim() : share.text
})

const parsed = computed(() =>
  parseCapture([note.value, sharedText.value].filter(Boolean).join('\n'), {
    now: new Date(),
    timeZone: formatter.value.timeZone,
  }),
)
const reminder = computed(() => parsed.value.reminder)
const linkTitle = computed(() => incoming.value?.title || hostOf(incoming.value?.url ?? null))

const draft = computed(() => {
  const share = incoming.value
  if (!share) return null
  return buildCapture({
    parsed: parsed.value,
    url: share.url,
    pageTitle: share.url ? share.title : null,
    images: share.images,
    source: 'SHARE_SHEET',
    timeZone: formatter.value.timeZone,
  })
})

function close() {
  incoming.value = null
}

async function save() {
  const built = draft.value
  if (!built || saving.value) return
  saving.value = true
  try {
    await capture(built.input, built.files)
    const local = localItem(built.input, previews.value)
    upsertItem(local)
    void rememberRecent(local)
    void toast(t('mobile.capture.saved'))
    close()
  } catch {
    void saveFailed()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <IonModal
    :is-open="open"
    class="omb-sheet omb-auto-sheet"
    :breakpoints="[0, 1]"
    :initial-breakpoint="1"
    handle
    @did-dismiss="close"
  >
    <div class="ion-page">
      <div v-if="incoming" class="sheet-body">
        <div class="head">
          <AppLogo :size="28" />
          <h2>{{ t('mobile.share.title') }}</h2>
          <button type="button" class="close" :aria-label="t('mobile.close')" @click="close">
            <AppIcon name="x" :stroke="2" />
          </button>
        </div>

        <p v-if="!session.token" class="omb-hint">{{ t('mobile.share.signInFirst') }}</p>
        <template v-else>
          <div v-if="incoming.url" class="preview omb-card">
            <span class="kind"><AppIcon name="link" :size="18" /></span>
            <span class="text">
              <span class="title">{{ linkTitle }}</span>
              <span class="host">{{ hostOf(incoming.url) }}</span>
            </span>
          </div>
          <div v-if="previews.length" class="images">
            <img v-for="src in previews" :key="src" :src="src" alt="" />
          </div>
          <p v-if="sharedText" class="shared">{{ sharedText }}</p>

          <label class="omb-label">
            {{ t('mobile.share.note') }}
            <textarea v-model="note" class="omb-input" rows="2" enterkeyhint="done" />
          </label>
          <div
            v-if="reminder || parsed.tags.length || parsed.remember"
            class="chips"
            aria-live="polite"
          >
            <span v-if="reminder" class="omb-chip omb-chip-rem">
              <AppIcon
                :name="reminder.kind === 'RECURRING' ? 'repeat' : 'clock'"
                :size="14"
                :stroke="2.2"
              />
              {{ formatter.reminder(reminder) }}
            </span>
            <span v-for="tag in parsed.tags" :key="tag" class="omb-chip omb-chip-tag">
              #{{ tag }}
            </span>
            <span v-if="parsed.remember" class="omb-chip omb-chip-accent">
              <AppIcon name="repeat" :size="14" />{{ t('mobile.capture.remember') }}
            </span>
          </div>
          <p v-if="!draft" class="omb-hint">{{ t('mobile.share.nothing') }}</p>

          <button
            type="button"
            class="omb-btn omb-btn-primary"
            :disabled="!draft || saving"
            @click="save"
          >
            {{ t('mobile.share.save') }}
          </button>
          <p class="omb-hint center">{{ t('mobile.share.offline') }}</p>
        </template>
      </div>
    </div>
  </IonModal>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.head h2 {
  flex-grow: 1;
  margin: 0;
  font-size: 19px;
  font-weight: 600;
}
.close {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--omb-text-toned);
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: var(--omb-surface-muted);
}
.kind {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--omb-link-bg);
  color: var(--omb-link-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.title {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.host {
  font-size: 13px;
  color: var(--omb-link);
}
.images {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}
.images img {
  width: 88px;
  height: 88px;
  border-radius: 12px;
  object-fit: cover;
}
.shared {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--omb-text-toned);
  white-space: pre-wrap;
  max-height: 120px;
  overflow: auto;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.center {
  text-align: center;
}
</style>
