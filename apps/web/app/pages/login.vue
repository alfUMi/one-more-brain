<script setup lang="ts">
import { authClient } from '~/lib/auth-client'

definePageMeta({ public: true, layout: false })

const { t } = useI18n()
useHead({ title: () => t('auth.title') })

const { data: providers } = await useFetch('/api/v1/auth/providers', {
  default: () => ({ google: false }),
})

const route = useRoute()
/** Where to land after signing in: a local path only, never another site. */
const next = computed(() => {
  const value = route.query.next
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
})

const email = ref('')
const sentTo = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function sendLink() {
  loading.value = true
  error.value = null
  const { error: err } = await authClient.signIn.magicLink({
    email: email.value,
    callbackURL: next.value,
  })
  loading.value = false
  if (err) error.value = t('auth.error')
  else sentTo.value = email.value
}

async function google() {
  await authClient.signIn.social({ provider: 'google', callbackURL: next.value })
}
</script>

<template>
  <div class="grid min-h-dvh bg-(--omb-surface) lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <!-- Form side -->
    <div class="flex flex-col px-6 py-8 sm:px-12 lg:px-16 lg:py-10">
      <div class="flex items-center gap-2.5">
        <AppLogo class="size-8" />
        <span class="font-display text-lg font-bold">{{ t('app.name') }}</span>
      </div>

      <main class="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-8 py-12">
        <template v-if="sentTo">
          <span
            class="flex size-14 items-center justify-center rounded-2xl bg-(--omb-accent-soft) text-(--omb-accent)"
          >
            <UIcon name="i-lucide-mail-check" class="size-7" />
          </span>
          <div class="flex flex-col gap-3">
            <h1 class="text-4xl leading-[1.1] font-bold tracking-tight">
              {{ t('auth.checkEmail') }}
            </h1>
            <p class="text-base leading-relaxed text-(--omb-text-muted)">
              {{ t('auth.checkEmailBody', { email: sentTo }) }}
            </p>
          </div>
          <button type="button" class="omb-btn omb-btn-outline" @click="sentTo = null">
            {{ t('auth.useAnother') }}
          </button>
        </template>

        <template v-else>
          <div class="flex flex-col gap-4">
            <h1 class="text-[40px] leading-[1.05] font-bold tracking-tight sm:text-5xl">
              {{ t('auth.headline') }}
            </h1>
            <p class="text-base leading-relaxed text-(--omb-text-muted)">
              {{ t('auth.subtitle') }}
            </p>
          </div>

          <div class="flex flex-col gap-4">
            <template v-if="providers.google">
              <button type="button" class="omb-btn omb-btn-outline" @click="google">
                <UIcon name="i-simple-icons-google" class="size-4" />
                {{ t('auth.google') }}
              </button>
              <div class="flex items-center gap-3 text-[13px] text-(--omb-text-muted)">
                <span class="h-px flex-1 bg-(--omb-border)" />
                {{ t('auth.or') }}
                <span class="h-px flex-1 bg-(--omb-border)" />
              </div>
            </template>

            <form class="flex flex-col gap-3" @submit.prevent="sendLink">
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-semibold">{{ t('auth.email') }}</span>
                <input
                  v-model="email"
                  type="email"
                  required
                  autocomplete="email"
                  :placeholder="t('auth.emailPlaceholder')"
                  class="h-12 rounded-lg border border-(--omb-border) bg-(--omb-surface) px-4 text-base outline-0 transition placeholder:text-(--omb-text-muted) focus:border-(--omb-accent) focus:ring-4 focus:ring-(--omb-accent-soft)"
                />
              </label>
              <button type="submit" class="omb-btn omb-btn-primary" :disabled="loading">
                <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-4 animate-spin" />
                {{ t('auth.sendLink') }}
                <UIcon v-if="!loading" name="i-lucide-arrow-right" class="size-4" />
              </button>
              <p v-if="error" role="alert" class="text-sm text-(--ui-error)">{{ error }}</p>
            </form>

            <p class="text-[13px] leading-relaxed text-(--omb-text-muted)">
              {{ t('auth.footnote') }}
            </p>
          </div>
        </template>
      </main>
    </div>

    <!-- Brand panel: real product moments from the mockups -->
    <aside
      aria-hidden="true"
      class="omb-hero relative hidden overflow-hidden bg-(--omb-hero-bg) text-(--omb-hero-text) lg:flex lg:flex-col lg:justify-between lg:p-12"
    >
      <div
        class="relative mx-auto mt-6 flex w-full max-w-[460px] flex-1 flex-col justify-center gap-5"
      >
        <!-- Smart capture -->
        <div class="omb-demo omb-float-a -ml-6 rotate-[-2deg] border-2 border-(--omb-accent)">
          <p class="text-[17px] font-medium">{{ t('auth.demo.capture') }}</p>
          <div class="flex flex-wrap items-center gap-2">
            <span class="omb-chip bg-(--omb-rem-bg) text-(--omb-rem-text)">
              <UIcon name="i-lucide-clock" class="size-3.5" />
              {{ t('auth.demo.reminder') }}
            </span>
            <span class="omb-chip bg-(--omb-tag-bg) text-(--omb-tag-text)">{{
              t('auth.demo.tag')
            }}</span>
            <span class="text-xs text-(--omb-text-muted)">{{ t('auth.demo.pickedUp') }}</span>
          </div>
        </div>

        <!-- Book highlight -->
        <div class="omb-demo omb-float-b ml-10 rotate-[1.5deg] flex-row! gap-3.5">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-(--omb-highlight-bg) text-(--omb-highlight-text)"
          >
            <UIcon name="i-lucide-highlighter" class="size-[18px]" />
          </span>
          <div class="flex min-w-0 flex-col gap-2">
            <span class="text-[15px] font-semibold">{{ t('auth.demo.highlightTitle') }}</span>
            <blockquote
              class="rounded-lg bg-(--omb-highlight-quote) px-3 py-2 text-sm leading-normal"
            >
              “{{ t('auth.demo.highlightQuote') }}”
            </blockquote>
            <span class="text-xs text-(--omb-text-muted)">{{
              t('auth.demo.highlightSource')
            }}</span>
          </div>
        </div>

        <!-- Spaced-repetition review -->
        <div class="omb-demo omb-float-c -ml-2 rotate-[-1deg]">
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-(--omb-text-muted)">{{
              t('auth.demo.reviewMeta')
            }}</span>
            <span class="flex-1" />
            <span class="h-1 w-5 rounded bg-(--omb-accent)" />
            <span class="h-1 w-5 rounded bg-(--omb-accent)" />
            <span class="h-1 w-5 rounded bg-(--omb-border)" />
            <span class="h-1 w-5 rounded bg-(--omb-border)" />
          </div>
          <p class="font-display text-lg leading-snug font-medium">
            “{{ t('auth.demo.reviewText') }}”
          </p>
          <div class="flex gap-2">
            <span class="omb-demo-btn border border-(--omb-border)">{{
              t('auth.demo.reviewForgot')
            }}</span>
            <span class="omb-demo-btn bg-(--omb-accent) text-(--omb-on-accent)">{{
              t('auth.demo.reviewGotIt')
            }}</span>
          </div>
        </div>
      </div>

      <p
        class="relative mx-auto mt-10 max-w-[460px] text-[15px] leading-relaxed font-medium opacity-90"
      >
        {{ t('auth.heroCaption') }}
      </p>
    </aside>
  </div>
</template>

<style scoped>
.omb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition:
    filter 0.15s,
    background 0.15s,
    transform 0.15s;
}
.omb-btn:active:not(:disabled) {
  transform: translateY(1px);
}
.omb-btn:disabled {
  opacity: 0.7;
  cursor: default;
}
.omb-btn-primary {
  background: var(--omb-accent);
  color: var(--omb-on-accent);
}
.omb-btn-primary:hover:not(:disabled) {
  filter: brightness(0.92);
}
.omb-btn-outline {
  border: 1px solid var(--omb-border);
  background: var(--omb-surface);
  color: var(--omb-text);
}
.omb-btn-outline:hover {
  background: var(--omb-hover);
}

/* Dot grid on the brand panel. */
.omb-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(currentColor 1px, transparent 1px);
  background-size: 22px 22px;
  opacity: 0.12;
}

.omb-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 16px;
  background: var(--omb-surface);
  color: var(--omb-text);
  box-shadow:
    0 1px 2px rgb(0 0 0 / 0.06),
    0 18px 40px -12px rgb(0 0 0 / 0.35);
}
.omb-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
}
.omb-demo-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}

@keyframes omb-float {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: 0 -8px;
  }
}
.omb-float-a {
  animation: omb-float 7s ease-in-out infinite;
}
.omb-float-b {
  animation: omb-float 8s ease-in-out -2.5s infinite;
}
.omb-float-c {
  animation: omb-float 9s ease-in-out -5s infinite;
}
@media (prefers-reduced-motion: reduce) {
  .omb-float-a,
  .omb-float-b,
  .omb-float-c {
    animation: none;
  }
}
</style>
