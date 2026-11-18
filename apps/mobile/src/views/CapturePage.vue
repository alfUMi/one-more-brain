<script setup lang="ts">
import { Clipboard } from '@capacitor/clipboard'
import { actionSheetController, IonContent, IonPage } from '@ionic/vue'
import { parseCapture } from '@omb/shared'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { tap } from '../lib/actions'
import { buildCapture, localItem } from '../lib/capture'
import { formatter, itemTitle, titleIsQuote } from '../lib/format'
import { capture, pending } from '../lib/outbox'
import { choosePhotos, takePhoto } from '../lib/photos'
import { session } from '../lib/session'
import { rememberRecent, store, upsertItem } from '../lib/store'
import { saveFailed, toast } from '../lib/toast'

/** Mockup: Mobile · Capture. The app opens here. */
const { t } = useI18n()
const router = useRouter()

const text = ref('')
const ignored = ref<string | null>(null)
const images = ref<{ blob: Blob; preview: string }[]>([])
const saving = ref(false)
const textarea = ref<HTMLTextAreaElement | null>(null)

const parsed = computed(() =>
  text.value.trim()
    ? parseCapture(text.value, { now: new Date(), timeZone: formatter.value.timeZone })
    : null,
)
const reminder = computed(() => {
  const r = parsed.value?.reminder
  return r && r.text !== ignored.value ? r : null
})
watch(text, (value) => {
  if (ignored.value && !value.includes(ignored.value)) ignored.value = null
})

const draft = computed(() =>
  buildCapture({
    parsed: parsed.value,
    ignoreReminder: !reminder.value,
    images: images.value.map((i) => i.blob),
    source: 'MOBILE',
    timeZone: formatter.value.timeZone,
  }),
)

async function save() {
  const built = draft.value
  if (!built || saving.value) return
  saving.value = true
  const previews = images.value.map((i) => i.preview)
  try {
    // On the phone first; it syncs now or when the network is back.
    await capture(built.input, built.files)
    const local = localItem(built.input, previews)
    upsertItem(local)
    void rememberRecent(local)
    tap()
    text.value = ''
    images.value = []
    ignored.value = null
    void toast(t('mobile.capture.saved'))
  } catch {
    void saveFailed()
  } finally {
    saving.value = false
  }
}

function addImages(blobs: Blob[]) {
  for (const blob of blobs.slice(0, 10 - images.value.length)) {
    images.value.push({ blob, preview: URL.createObjectURL(blob) })
  }
}

function removeImage(index: number) {
  const [img] = images.value.splice(index, 1)
  if (img) URL.revokeObjectURL(img.preview)
}
onBeforeUnmount(() => images.value.forEach((i) => URL.revokeObjectURL(i.preview)))

async function photo() {
  const sheet = await actionSheetController.create({
    buttons: [
      { text: t('mobile.capture.takePhoto'), data: 'camera' },
      { text: t('mobile.capture.choosePhoto'), data: 'library' },
      { text: t('actions.cancel'), role: 'cancel' },
    ],
  })
  await sheet.present()
  const { data } = await sheet.onDidDismiss<string>()
  if (data === 'camera') {
    const blob = await takePhoto()
    if (blob) addImages([blob])
  } else if (data === 'library') {
    addImages(await choosePhotos(10 - images.value.length))
  }
}

async function pasteLink() {
  const { value } = await Clipboard.read().catch(() => ({ value: '' }))
  const url = String(value ?? '').match(/https?:\/\/[^\s<>"']+/i)?.[0]
  if (!url) {
    void toast(t('mobile.capture.noLink'))
    return
  }
  text.value = text.value.trim() ? `${text.value.trim()} ${url}` : url
  textarea.value?.focus()
}

function talk() {
  void toast(t('mobile.capture.talkSoon'))
}

/** The settings button is the user's initial (mockup: a round avatar). */
const initial = computed(() =>
  (session.profile?.name || session.profile?.email || '').trim().charAt(0).toUpperCase(),
)

const pendingIds = computed(() => new Set(pending.value.map((e) => e.id)))
const recent = computed(() => {
  // Captures still waiting in the outbox first (they may not be in `recent` after a restart).
  const waiting = pending.value
    .filter((e) => !store.recent.some((x) => x.id === e.id))
    .map((e) => localItem(e.input))
  return [...waiting, ...store.recent].slice(0, 5)
})

function recentMeta(id: string, kind: string, capturedAt: string) {
  const when = pendingIds.value.has(id)
    ? t('mobile.capture.offlineWillSync')
    : formatter.value.relative(capturedAt)
  return `${t(`mobile.kind.${kind}`)} · ${when}`
}

function open(id: string) {
  if (!pendingIds.value.has(id)) void router.push(`/item/${id}`)
}
</script>

<template>
  <IonPage>
    <IonContent>
      <header class="omb-header head">
        <h1>{{ t('mobile.capture.title') }}</h1>
        <div class="grow" />
        <button
          type="button"
          class="avatar"
          :aria-label="t('mobile.capture.settings')"
          @click="router.push('/settings')"
        >
          <template v-if="initial">{{ initial }}</template>
          <AppIcon v-else name="gear" :size="20" />
        </button>
      </header>
      <p v-if="!store.online" class="omb-banner" role="status">{{ t('offline.banner') }}</p>

      <main class="main">
        <div class="box">
          <label class="sr-only" for="capture-text">{{ t('mobile.capture.label') }}</label>
          <textarea
            id="capture-text"
            ref="textarea"
            v-model="text"
            rows="3"
            :placeholder="t('mobile.capture.label')"
            enterkeyhint="enter"
          />
          <div v-if="images.length" class="images">
            <span v-for="(img, i) in images" :key="img.preview" class="img">
              <img :src="img.preview" alt="" />
              <button
                type="button"
                :aria-label="t('mobile.capture.removePhoto')"
                @click="removeImage(i)"
              >
                <AppIcon name="x" :size="14" :stroke="2.4" />
              </button>
            </span>
          </div>
          <div
            v-if="reminder || parsed?.tags.length || parsed?.remember || parsed?.urls.length"
            class="chips"
            aria-live="polite"
          >
            <span v-if="reminder" class="omb-chip omb-chip-rem">
              {{ formatter.reminder(reminder) }}
              <button
                type="button"
                :aria-label="t('mobile.capture.ignoreReminder')"
                @click="ignored = reminder.text"
              >
                <AppIcon name="x" :size="14" :stroke="2.2" />
              </button>
            </span>
            <span v-for="tag in parsed?.tags" :key="tag" class="omb-chip omb-chip-tag">{{
              tag
            }}</span>
            <span v-if="parsed?.remember" class="omb-chip omb-chip-accent">
              <AppIcon name="repeat" :size="14" />{{ t('mobile.capture.remember') }}
            </span>
            <span v-if="parsed?.urls.length" class="omb-chip omb-chip-tag">
              <AppIcon name="link" :size="14" />{{ t('mobile.kind.LINK') }}
            </span>
          </div>
          <button
            type="button"
            class="omb-btn omb-btn-primary save"
            :disabled="!draft || saving"
            @click="save"
          >
            {{ t('mobile.capture.save') }}
          </button>
        </div>

        <div class="big-row">
          <button type="button" class="big" @click="talk">
            <span class="circle"><AppIcon name="mic" /></span>
            {{ t('mobile.capture.talk') }}
          </button>
          <button type="button" class="big" @click="photo">
            <span class="circle"><AppIcon name="camera" /></span>
            {{ t('mobile.capture.photo') }}
          </button>
          <button type="button" class="big" @click="pasteLink">
            <span class="circle"><AppIcon name="link" /></span>
            {{ t('mobile.capture.pasteLink') }}
          </button>
        </div>

        <section aria-labelledby="recent-h" class="recent">
          <div class="recent-head">
            <h2 id="recent-h">{{ t('mobile.capture.justCaptured') }}</h2>
            <div class="grow" />
            <span v-if="pending.length" class="waiting">
              <span class="omb-rem-dot" />{{ t('mobile.capture.waiting', { n: pending.length }) }}
            </span>
          </div>
          <p v-if="!recent.length" class="omb-hint">{{ t('mobile.capture.nothingYet') }}</p>
          <button
            v-for="item in recent"
            :key="item.id"
            type="button"
            class="recent-row"
            @click="open(item.id)"
          >
            <span class="recent-text" :class="{ 'omb-quote': titleIsQuote(item) }">{{
              itemTitle(item) || t(`mobile.kind.${item.kind}`)
            }}</span>
            <span class="omb-meta">{{ recentMeta(item.id, item.kind, item.capturedAt) }}</span>
          </button>
        </section>
      </main>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.head {
  align-items: center;
  padding-bottom: 16px;
}
.avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 999px;
  background: var(--omb-surface);
  box-shadow: 0 1px 2px rgba(17, 17, 17, 0.06);
  color: var(--omb-text);
  font: 600 14px var(--ion-font-family);
  display: flex;
  align-items: center;
  justify-content: center;
}
.main {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.box {
  background: var(--omb-surface);
  border-radius: 20px;
  box-shadow: var(--omb-shadow);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
textarea {
  border: 0;
  outline: 0;
  padding: 0;
  resize: none;
  font: 400 19px/1.4 var(--ion-font-family);
  color: var(--omb-text);
  background: transparent;
}
textarea::placeholder {
  color: var(--omb-text-faint);
}
.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.images {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-top: 6px;
}
.img {
  position: relative;
  flex: none;
}
.img img {
  width: 72px;
  height: 72px;
  border-radius: 14px;
  object-fit: cover;
  display: block;
}
.img button {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 2px solid var(--omb-surface);
  background: var(--omb-inverse-bg);
  color: var(--omb-inverse-text);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.save {
  min-height: 50px;
  font-size: 15.5px;
}
.big-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.big {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 92px;
  border: 0;
  border-radius: 20px;
  background: var(--omb-surface);
  box-shadow: var(--omb-shadow-sm);
  font: 500 13px var(--ion-font-family);
  color: var(--omb-text);
  text-align: center;
  padding: 0 4px;
}
.big:active {
  background: var(--omb-hover);
}
.circle {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: var(--omb-chip-bg);
  color: var(--omb-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.recent {
  display: flex;
  flex-direction: column;
  padding: 8px 4px 0;
}
.recent-head {
  display: flex;
  align-items: center;
  padding-bottom: 4px;
}
.recent-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.recent .omb-hint {
  padding-top: 8px;
}
.waiting {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--omb-text-muted);
}
.recent-row {
  padding: 12px 0;
  border: 0;
  border-top: 1px solid var(--omb-divider);
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  font: inherit;
  color: var(--omb-text);
}
.recent-head + .recent-row {
  border-top-color: transparent;
}
.recent-text {
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
</style>
