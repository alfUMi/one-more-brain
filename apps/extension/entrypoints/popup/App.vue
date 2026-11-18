<script setup lang="ts">
import {
  ACCENT_COLORS,
  ACCENT_SOFT,
  ACCENTS,
  DEFAULT_ACCENT,
  createFormatter,
  newId,
  parseCapture,
  type Accent,
  type CreateItemInput,
} from '@omb/shared'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { browser, type Browser } from 'wxt/browser'
import { APP_URL, signInUrl } from '../../lib/config'
import { fill, strings, translator } from '../../lib/i18n'
import type { ExtensionMessage } from '../../lib/messages'
import { getSession, type Profile } from '../../lib/session'

const profile = ref<Profile | null>(null)
const ready = ref(false)
const tab = ref<Browser.tabs.Tab | null>(null)
const waiting = ref(0)

const s = computed(() => strings(profile.value?.locale))
const timeZone = computed(
  () => profile.value?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
)
const fmt = computed(() => {
  const { locale, t } = translator(profile.value?.locale)
  return createFormatter({ locale, timeZone: timeZone.value, t })
})

const text = ref('')
const textarea = useTemplateRef('textarea')
const attachPage = ref(true)
const screenshot = ref<string | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

const pageUrl = computed(() =>
  tab.value?.url && /^https?:\/\//i.test(tab.value.url) ? tab.value.url : undefined,
)

const parsed = computed(() =>
  text.value.trim()
    ? parseCapture(text.value, { now: new Date(), timeZone: timeZone.value })
    : null,
)
const canSave = computed(() =>
  Boolean(parsed.value?.body || parsed.value?.urls.length || screenshot.value),
)

/** Same palette as the web app: the profile's theme and accent. */
function applyTheme(p: Profile | null) {
  const theme = p?.theme ?? 'system'
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const accent: Accent = (ACCENTS as readonly string[]).includes(p?.accent ?? '')
    ? (p!.accent as Accent)
    : DEFAULT_ACCENT
  const mode = dark ? 'dark' : 'light'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.setProperty('--omb-accent', ACCENT_COLORS[accent][mode])
  root.style.setProperty('--omb-accent-soft', ACCENT_SOFT[accent][mode])
  root.lang = p?.locale === 'ru' ? 'ru' : 'en'
}

function send<T = { ok: boolean }>(message: ExtensionMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>
}

onMounted(async () => {
  const session = await getSession()
  profile.value = session.token ? (session.profile ?? null) : null
  applyTheme(profile.value)
  ;[tab.value = null] = await browser.tabs.query({ active: true, currentWindow: true })
  ready.value = true
  if (profile.value) {
    waiting.value = (await send<{ count?: number }>({ type: 'omb:pending' })).count ?? 0
    await nextTick()
    textarea.value?.focus()
  }
})

async function takeScreenshot() {
  error.value = null
  try {
    screenshot.value = await browser.tabs.captureVisibleTab({ format: 'png' })
  } catch {
    error.value = s.value.failed
  }
}

function buildInput(): CreateItemInput | null {
  const p = parsed.value ?? { body: '', urls: [], tags: [], remember: false, reminder: null }
  const typedUrl = p.urls[0]
  const body = typedUrl
    ? p.body
        .replace(typedUrl, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    : p.body
  const url = typedUrl ?? (attachPage.value ? pageUrl.value : undefined)
  if (!body && !url && !screenshot.value) return null
  const pageAttached = !typedUrl && url === pageUrl.value
  const r = p.reminder
  return {
    id: newId(),
    kind: screenshot.value ? 'IMAGE' : url ? 'LINK' : 'TEXT',
    source: 'EXTENSION',
    body: body || undefined,
    url,
    pageTitle: pageAttached ? tab.value?.title?.slice(0, 500) : undefined,
    favicon:
      pageAttached && tab.value?.favIconUrl && /^https?:\/\//.test(tab.value.favIconUrl)
        ? tab.value.favIconUrl.slice(0, 2000)
        : undefined,
    tags: p.tags,
    remember: p.remember,
    capturedAt: new Date(),
    reminder: r
      ? { id: newId(), kind: r.kind, fireAt: r.fireAt, rrule: r.rrule, timezone: timeZone.value }
      : undefined,
  }
}

async function save() {
  const input = buildInput()
  if (!input || saving.value) return
  saving.value = true
  error.value = null
  try {
    const res = await send({
      type: 'omb:capture',
      input,
      screenshot: screenshot.value ?? undefined,
      tabId: pageUrl.value ? tab.value?.id : undefined,
    })
    if (!res.ok) throw new Error('rejected')
    window.close()
  } catch {
    error.value = s.value.failed
    saving.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    void save()
  }
}

async function signIn() {
  await browser.tabs.create({ url: signInUrl(browser.runtime.id) })
  window.close()
}

async function openApp() {
  await browser.tabs.create({ url: APP_URL })
  window.close()
}

async function signOut() {
  await send({ type: 'omb:sign-out' })
  profile.value = null
  applyTheme(null)
}
</script>

<template>
  <main v-if="ready" class="popup">
    <template v-if="profile">
      <header class="row">
        <h1 class="title">{{ s.quickCapture }}</h1>
        <span class="grow" />
        <span class="muted small">{{ s.savesToInbox }}</span>
      </header>

      <textarea
        ref="textarea"
        v-model="text"
        rows="3"
        class="input"
        :aria-label="s.quickCapture"
        :placeholder="s.placeholder"
        @keydown="onKeydown"
      />

      <div v-if="parsed?.reminder || parsed?.tags.length" class="chips">
        <span v-if="parsed?.reminder" class="chip chip-rem">
          <svg
            v-if="parsed.reminder.kind === 'RECURRING'"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
          <span v-else class="dot" aria-hidden="true" />
          {{ fmt.reminder(parsed.reminder) }}
        </span>
        <span v-for="tag in parsed?.tags" :key="tag" class="chip chip-tag">{{ tag }}</span>
      </div>

      <label v-if="pageUrl" class="attach">
        <input v-model="attachPage" type="checkbox" />
        <span class="attach-text">
          <span class="attach-title">{{ s.attachPage }}</span>
          <span class="muted small ellipsis">{{ tab?.title || pageUrl }}</span>
        </span>
      </label>

      <div v-if="screenshot" class="shot">
        <img :src="screenshot" alt="" />
        <button
          type="button"
          class="shot-remove"
          :aria-label="s.removeScreenshot"
          :title="s.removeScreenshot"
          @click="screenshot = null"
        >
          ×
        </button>
      </div>

      <p v-if="error" role="alert" class="error">{{ error }}</p>

      <footer class="row">
        <button
          type="button"
          class="icon-btn"
          :aria-label="s.screenshot"
          :title="s.screenshot"
          @click="takeScreenshot"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path
              d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <span class="grow" />
        <span class="muted small">{{ s.escToClose }}</span>
        <button type="button" class="primary" :disabled="!canSave || saving" @click="save">
          {{ s.save }} ⏎
        </button>
      </footer>

      <div class="account muted small">
        <span class="ellipsis">{{ fill(s.signedInAs, { email: profile.email }) }}</span>
        <span v-if="waiting" class="waiting">· {{ fill(s.waiting, { n: waiting }) }}</span>
        <span class="grow" />
        <button type="button" class="link" @click="openApp">{{ s.openApp }}</button>
        <button type="button" class="link" @click="signOut">{{ s.signOut }}</button>
      </div>
    </template>

    <template v-else>
      <div class="row">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <rect width="28" height="28" rx="8" fill="var(--omb-accent)" />
          <circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" stroke-width="2" />
          <circle cx="18.5" cy="9.5" r="2.5" fill="#fff" />
        </svg>
        <span class="title">One More Brain</span>
      </div>
      <h1 class="headline">{{ s.signInTitle }}</h1>
      <p class="muted body">{{ s.signInBody }}</p>
      <button type="button" class="primary wide" @click="signIn">{{ s.signIn }}</button>
    </template>
  </main>
</template>
