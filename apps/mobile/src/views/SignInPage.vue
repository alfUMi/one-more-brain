<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLogo from '../components/AppLogo.vue'
import { googleEnabled, sendMagicLink, signInWithGoogle } from '../lib/auth'
import { APP_HOST } from '../lib/config'
import { toast } from '../lib/toast'

/** Mockup: Mobile · Sign in. */
const { t } = useI18n()
const email = ref('')
const sentTo = ref<string | null>(null)
const sending = ref(false)
const google = ref(false)

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
        <div class="hero">
          <AppLogo :size="56" />
          <h1>{{ t('app.name') }}</h1>
          <p>{{ t('mobile.signIn.tagline') }}</p>
        </div>

        <div v-if="sentTo" class="form">
          <h2>{{ t('mobile.signIn.checkEmail') }}</h2>
          <p class="body">{{ t('mobile.signIn.checkEmailBody', { email: sentTo }) }}</p>
          <button type="button" class="omb-btn" @click="sentTo = null">
            {{ t('mobile.signIn.useAnother') }}
          </button>
        </div>

        <form v-else class="form" @submit.prevent="send">
          <template v-if="google">
            <button type="button" class="omb-btn" @click="withGoogle">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.1zM12 6c1.5 0 2.8.5 3.9 1.5l2.8-2.8A9.7 9.7 0 0 0 12 2 10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z"
                />
              </svg>
              {{ t('mobile.signIn.google') }}
            </button>
            <div class="or"><span />{{ t('mobile.signIn.or') }}<span /></div>
          </template>
          <label class="omb-label">
            {{ t('mobile.signIn.email') }}
            <input
              v-model="email"
              class="omb-input"
              type="email"
              inputmode="email"
              autocomplete="email"
              autocapitalize="off"
              required
              :placeholder="t('mobile.signIn.emailPlaceholder')"
            />
          </label>
          <button type="submit" class="omb-btn omb-btn-primary" :disabled="sending">
            {{ t('mobile.signIn.sendLink') }}
          </button>
          <p class="omb-hint center">{{ t('mobile.signIn.browserHint') }}</p>
          <p class="omb-hint center server">{{ t('mobile.signIn.server', { host: APP_HOST }) }}</p>
        </form>
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
  padding: calc(var(--ion-safe-area-top, 0px) + 24px) 24px
    calc(var(--ion-safe-area-bottom, 0px) + 32px);
}
.hero {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  min-height: 280px;
}
.hero h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.15;
}
.hero p {
  margin: 0;
  font-size: 17px;
  line-height: 1.5;
  color: var(--omb-text-toned);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form h2 {
  margin: 0;
  font-size: 22px;
}
.body {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--omb-text-toned);
}
.or {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--omb-text-muted);
}
.or span {
  flex-grow: 1;
  height: 1px;
  background: var(--omb-border);
}
.center {
  text-align: center;
}
.server {
  opacity: 0.8;
}
</style>
