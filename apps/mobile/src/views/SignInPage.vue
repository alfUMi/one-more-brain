<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLogo from '../components/AppLogo.vue'
import { googleEnabled, sendMagicLink, signInWithGoogle } from '../lib/auth'
import { APP_HOST } from '../lib/config'
import { toast } from '../lib/toast'

/** Mockup: Mobile · Sign in. */
const { t, locale } = useI18n()
const email = ref('')
const sentTo = ref<string | null>(null)
const sending = ref(false)
const google = ref(false)
/** With Google on, the email form opens from "Sign in with email". */
const emailOpen = ref(false)

/** The demo cards on top: what a note, a highlight and a review look like. */
const demoMeta = computed(() =>
  [
    t('mobile.kind.HIGHLIGHT'),
    t('sources.EXTENSION'),
    new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto', style: 'short' }).format(
      -1,
      'hour',
    ),
  ].join(' · '),
)

onMounted(async () => {
  google.value = await googleEnabled()
})

async function send() {
  if (!email.value.trim() || sending.value) return
  sending.value = true
  try {
    await sendMagicLink(email.value.trim())
    sentTo.value = email.value.trim()
  } catch {
    void toast(t('mobile.signIn.failed'), { error: true })
  } finally {
    sending.value = false
  }
}

async function withGoogle() {
  try {
    await signInWithGoogle()
  } catch {
    void toast(t('mobile.signIn.failed'), { error: true })
  }
}
</script>

<template>
  <IonPage>
    <IonContent :scroll-y="true">
      <div class="wrap">
        <div class="demo" aria-hidden="true">
          <div class="demo-card one">
            <span class="demo-text">
              {{ t('settings.previewNote') }} #{{ t('mobile.signIn.demoTag') }}
            </span>
            <span class="demo-chips">
              <span class="omb-chip omb-chip-sm omb-chip-rem">{{
                t('settings.previewReminder')
              }}</span>
              <span class="omb-chip omb-chip-sm">{{ t('mobile.signIn.demoTag') }}</span>
            </span>
          </div>
          <div class="demo-card two">
            <span class="demo-quote omb-quote">{{ t('mobile.signIn.demoQuote') }}</span>
            <span class="omb-meta">{{ demoMeta }}</span>
          </div>
          <div class="demo-card three">
            <span class="demo-review">
              <span class="strong">{{ t('mobile.today.toReview', { n: 4 }) }}</span>
              <span class="omb-meta">{{ t('mobile.today.aboutMinutes', { n: 2 }) }}</span>
            </span>
            <span class="demo-btn">{{ t('review.title') }}</span>
          </div>
        </div>

        <main class="main">
          <span class="brand"><AppLogo :size="20" />{{ t('app.name') }}</span>
          <h1>{{ t('mobile.signIn.headline') }}</h1>
          <p class="tagline">{{ t('mobile.signIn.tagline') }}</p>
          <div class="grow" />

          <div v-if="sentTo" class="form">
            <h2>{{ t('mobile.signIn.checkEmail') }}</h2>
            <p class="body">{{ t('mobile.signIn.checkEmailBody', { email: sentTo }) }}</p>
            <button type="button" class="omb-btn omb-btn-white big" @click="sentTo = null">
              {{ t('mobile.signIn.useAnother') }}
            </button>
          </div>

          <div v-else-if="google && !emailOpen" class="form">
            <button type="button" class="omb-btn omb-btn-dark big" @click="withGoogle">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0 0 12 22z"
                />
                <path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.9V7H2.7a10 10 0 0 0 0 9l3.5-2.4z" />
                <path
                  fill="#EA4335"
                  d="M12 5.9c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.7 7l3.5 2.7C7 7.7 9.3 5.9 12 5.9z"
                />
              </svg>
              {{ t('mobile.signIn.google') }}
            </button>
            <button type="button" class="omb-btn omb-btn-white big" @click="emailOpen = true">
              {{ t('mobile.signIn.withEmail') }}
            </button>
          </div>

          <form v-else class="form" @submit.prevent="send">
            <label class="sr-only" for="sign-in-email">{{ t('mobile.signIn.email') }}</label>
            <input
              id="sign-in-email"
              v-model="email"
              class="omb-input email"
              type="email"
              inputmode="email"
              autocomplete="email"
              autocapitalize="off"
              required
              :placeholder="t('mobile.signIn.emailPlaceholder')"
            />
            <button type="submit" class="omb-btn omb-btn-primary big" :disabled="sending">
              {{ t('mobile.signIn.sendLink') }}
            </button>
            <button
              v-if="google"
              type="button"
              class="omb-btn omb-btn-ghost"
              @click="emailOpen = false"
            >
              {{ t('mobile.back') }}
            </button>
          </form>

          <p class="omb-meta hint">{{ t('mobile.signIn.browserHint') }}</p>
          <p class="omb-meta hint server">{{ t('mobile.signIn.server', { host: APP_HOST }) }}</p>
        </main>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.wrap {
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: calc(var(--ion-safe-area-top, 0px) + 12px) 0
    calc(var(--ion-safe-area-bottom, 0px) + 28px);
}

/* Dotted panel with three tilted demo cards. */
.demo {
  position: relative;
  flex: none;
  height: 372px;
  margin: 0 12px;
  border-radius: 30px;
  background-color: var(--omb-hover);
  background-image: radial-gradient(#d6d6d1 1px, transparent 1px);
  background-size: 20px 20px;
  overflow: hidden;
}
:global(.dark) .demo {
  background-image: radial-gradient(#3a3a3a 1px, transparent 1px);
}
.demo-card {
  position: absolute;
  background: var(--omb-surface);
  border-radius: 18px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  box-shadow:
    0 1px 2px rgba(17, 17, 17, 0.04),
    0 16px 36px -12px rgba(17, 17, 17, 0.24);
}
.demo-card.one {
  left: 22px;
  right: 46px;
  top: 58px;
  transform: rotate(-3deg);
}
.demo-card.two {
  left: 60px;
  right: 18px;
  top: 150px;
  transform: rotate(2deg);
}
.demo-card.three {
  left: 30px;
  right: 36px;
  top: 258px;
  transform: rotate(-1.5deg);
  flex-direction: row;
  align-items: center;
  gap: 10px;
}
.demo-text {
  font-size: 15px;
}
.demo-chips {
  display: flex;
  gap: 6px;
}
.demo-quote {
  font-size: 15px;
  line-height: 1.45;
  color: var(--omb-quote-text);
}
.demo-card .omb-meta {
  font-size: 11.5px;
}
.demo-review {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.strong {
  font-size: 14px;
  font-weight: 600;
}
.demo-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--omb-accent);
  color: var(--omb-on-accent);
  font-size: 12.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.main {
  flex-grow: 1;
  padding: 26px 24px 0;
  display: flex;
  flex-direction: column;
}
.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 14.5px;
  font-weight: 600;
}
.main h1 {
  margin: 14px 0 0;
  font-size: 30px;
  line-height: 1.12;
  font-weight: 600;
  letter-spacing: -0.03em;
  white-space: pre-line;
}
.tagline {
  margin: 8px 0 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--omb-text-muted);
}
.grow {
  min-height: 24px;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.form h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.body {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--omb-text-toned);
}
.big {
  min-height: 52px;
  gap: 10px;
  font-size: 15.5px;
  font-weight: 600;
}
.email {
  min-height: 52px;
  border-radius: 999px;
  padding: 0 20px;
  background: var(--omb-surface);
  box-shadow: var(--omb-shadow-sm);
}
.hint {
  margin: 14px 0 0;
  text-align: center;
  line-height: 1.5;
}
.server {
  margin-top: 4px;
  opacity: 0.8;
}
</style>
