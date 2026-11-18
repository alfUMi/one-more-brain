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
    class="omb-sheet omb-auto-sheet omb-sheet-page"
    :breakpoints="[0, 1]"
    :initial-breakpoint="1"
    handle
    @did-dismiss="close"
  >
    <div class="ion-page">
      <div v-if="incoming" class="sheet-body">
        <div class="head">
          <AppLogo :size="22" />
          <h2>{{ t('mobile.share.title') }}</h2>
          <button type="button" class="cancel" @click="close">
            {{ t('actions.cancel') }}
          </button>
        </div>

        <p v-if="!session.token" class="omb-hint">{{ t('mobile.share.signInFirst') }}</p>
        <template v-else>
          <div v-if="incoming.url" class="card preview">
            <span class="thumb"><AppIcon name="link" :size="20" /></span>
            <span class="text">
              <span class="title">{{ linkTitle }}</span>
              <span class="omb-meta host">{{ hostOf(incoming.url) }}</span>
            </span>
          </div>
          <div v-if="previews.length" class="images">
            <img v-for="src in previews" :key="src" :src="src" alt="" />
          </div>

          <label class="card note">
            <span class="note-label">{{ t('mobile.share.note') }}</span>
            <span v-if="sharedText" class="shared">{{ sharedText }}</span>
            <textarea v-model="note" rows="2" enterkeyhint="done" />
            <span
              v-if="reminder || parsed.tags.length || parsed.remember"
              class="chips"
              aria-live="polite"
            >
              <span v-if="reminder" class="omb-chip omb-chip-rem">
                {{ formatter.reminder(reminder) }}
              </span>
              <span v-for="tag in parsed.tags" :key="tag" class="omb-chip omb-chip-tag">
                {{ tag }}
              </span>
              <span v-if="parsed.remember" class="omb-chip omb-chip-accent">
                <AppIcon name="repeat" :size="14" />{{ t('mobile.capture.remember') }}
              </span>
            </span>
          </label>
          <p v-if="!draft" class="omb-hint">{{ t('mobile.share.nothing') }}</p>

          <button
            type="button"
            class="omb-btn omb-btn-primary save"
            :disabled="!draft || saving"
            @click="save"
          >
            {{ t('mobile.share.save') }}
          </button>
          <p class="omb-meta center">{{ t('mobile.share.offline') }}</p>
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
  padding: 0 6px;
}
.head h2 {
  flex-grow: 1;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.cancel {
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font: 500 14px var(--ion-font-family);
  color: var(--omb-icon);
}
.card {
  background: var(--omb-surface);
  border-radius: 20px;
  box-shadow: var(--omb-shadow-sm);
}
.preview {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 16px 18px;
}
.thumb {
  flex: none;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--omb-hover);
  color: var(--omb-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
.text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.title {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.host {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.images {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}
.images img {
  width: 88px;
  height: 88px;
  border-radius: 14px;
  object-fit: cover;
}
.note {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.note-label {
  font-size: 12.5px;
  color: var(--omb-text-muted);
}
.shared {
  display: block;
  font-size: 14px;
  line-height: 1.45;
  color: var(--omb-text-toned);
  white-space: pre-wrap;
  max-height: 120px;
  overflow: auto;
}
textarea {
  border: 0;
  outline: 0;
  padding: 0;
  resize: none;
  font: 400 16px/1.4 var(--ion-font-family);
  color: var(--omb-text);
  background: transparent;
}
.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.save {
  min-height: 52px;
  font-size: 15.5px;
}
.center {
  margin: 0;
  text-align: center;
  font-size: 12.5px;
}
</style>
