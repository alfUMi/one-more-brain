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

// The mobile app opens /login?provider=google to go straight to Google.
onMounted(() => {
  if (route.query.provider === 'google' && providers.value.google) void google()
})
</script>

<template>
  <div class="flex min-h-dvh flex-wrap bg-(--omb-bg)">
    <!-- Form side -->
    <div class="flex min-w-0 flex-[1_1_480px] flex-col px-6 py-8 sm:px-14 lg:py-9">
      <div class="flex items-center gap-2.5 text-base font-semibold">
        <AppLogo class="size-[26px]" />
        {{ t('app.name') }}
      </div>

      <main class="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-8 py-16">
        <template v-if="sentTo">
          <span
            class="flex size-14 items-center justify-center rounded-full bg-(--omb-surface) shadow-(--omb-shadow)"
          >
            <UIcon name="i-lucide-mail-check" class="size-7" />
          </span>
          <div class="flex flex-col gap-3">
            <h1 class="text-[40px] leading-[1.08] font-semibold">{{ t('auth.checkEmail') }}</h1>
            <p class="text-[16.5px] leading-relaxed text-(--omb-text-muted)">
              {{ t('auth.checkEmailBody', { email: sentTo }) }}
            </p>
          </div>
          <button type="button" class="omb-auth-btn omb-auth-white" @click="sentTo = null">
            {{ t('auth.useAnother') }}
          </button>
        </template>

        <template v-else>
          <div class="flex flex-col gap-3">
            <h1 class="text-[40px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[44px]">
              {{ t('auth.headline') }}
            </h1>
            <p class="text-[16.5px] leading-relaxed text-(--omb-text-muted)">
              {{ t('auth.subtitle') }}
            </p>
          </div>

          <div class="flex flex-col gap-3">
            <template v-if="providers.google">
              <button type="button" class="omb-auth-btn omb-auth-white" @click="google">
                <UIcon name="i-simple-icons-google" class="size-[18px]" />
                {{ t('auth.google') }}
              </button>
              <div class="flex items-center gap-3 py-1 text-[12.5px] text-(--omb-text-muted)">
                <span class="h-px flex-1 bg-(--omb-border)" />
                {{ t('auth.or') }}
                <span class="h-px flex-1 bg-(--omb-border)" />
              </div>
            </template>

            <form class="flex flex-col gap-3" @submit.prevent="sendLink">
              <label class="flex flex-col gap-1.5">
                <span class="text-[13.5px] font-medium">{{ t('auth.email') }}</span>
                <input
                  v-model="email"
                  type="email"
                  required
                  autocomplete="email"
                  :placeholder="t('auth.emailPlaceholder')"
                  class="h-[50px] rounded-[14px] border border-(--omb-border) bg-(--omb-surface) px-[18px] text-[15px] outline-0 transition placeholder:text-(--omb-text-muted) focus:border-(--omb-accent)"
                />
              </label>
              <button type="submit" class="omb-auth-btn omb-auth-primary" :disabled="loading">
                <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-4 animate-spin" />
                {{ t('auth.sendLink') }}
                <template v-if="!loading">→</template>
              </button>
              <p v-if="error" role="alert" class="text-sm text-(--ui-error)">{{ error }}</p>
            </form>

            <p class="mt-1 text-[12.5px] leading-relaxed text-(--omb-text-muted)">
              {{ t('auth.footnote') }}
            </p>
          </div>
        </template>
      </main>
    </div>

    <!-- Brand panel: real product moments from the mockups -->
    <aside
      aria-hidden="true"
      class="omb-dotted m-4 hidden min-w-0 flex-[1.1_1_520px] flex-col justify-center gap-9 rounded-[32px] px-12 py-16 lg:flex"
    >
      <div class="mx-auto flex w-full max-w-[440px] flex-col gap-[22px]">
        <!-- Smart capture -->
        <div class="omb-demo omb-float-a -ml-6 rotate-[-2deg]">
          <span class="text-[17px]">{{ t('auth.demo.capture') }}</span>
          <span class="flex flex-wrap items-center gap-2">
            <span class="omb-chip omb-chip-rem">
              <span class="omb-rem-dot" />
              {{ t('auth.demo.reminder') }}
            </span>
            <span class="omb-chip omb-chip-tag">{{ t('auth.demo.tag').replace(/^#/, '') }}</span>
            <span class="omb-meta">{{ t('auth.demo.pickedUp') }}</span>
          </span>
        </div>

        <!-- Book highlight -->
        <div class="omb-demo omb-float-b ml-10 rotate-[1.5deg]">
          <span class="text-[15px] font-semibold">{{ t('auth.demo.highlightTitle') }}</span>
          <span class="omb-quote text-[16.5px] leading-normal">
            “{{ t('auth.demo.highlightQuote') }}”
          </span>
          <span class="omb-meta">{{ t('auth.demo.highlightSource') }}</span>
        </div>

        <!-- Spaced-repetition review -->
        <div class="omb-demo omb-float-c -ml-2 rotate-[-1deg]">
          <span class="flex items-center gap-1.5">
            <span class="omb-meta">{{ t('auth.demo.reviewMeta') }}</span>
            <span class="flex-1" />
            <span class="h-1 w-[18px] rounded-full bg-(--omb-accent)" />
            <span class="h-1 w-[18px] rounded-full bg-(--omb-accent)" />
            <span class="h-1 w-[18px] rounded-full bg-(--omb-border)" />
            <span class="h-1 w-[18px] rounded-full bg-(--omb-border)" />
          </span>
          <span class="font-(family-name:--font-quote) text-[19px] leading-[1.45]">
            “{{ t('auth.demo.reviewText') }}”
          </span>
          <span class="grid grid-cols-2 gap-2">
            <span class="omb-demo-btn bg-(--omb-hover)">{{ t('auth.demo.reviewForgot') }}</span>
            <span class="omb-demo-btn bg-(--omb-accent) font-semibold text-(--omb-on-accent)">{{
              t('auth.demo.reviewGotIt')
            }}</span>
          </span>
        </div>
      </div>

      <p class="mx-auto w-full max-w-[440px] text-[15.5px] leading-normal text-(--omb-text-toned)">
        {{ t('auth.heroCaption') }}
      </p>
    </aside>
  </div>
</template>

<style scoped>
.omb-auth-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 50px;
  padding: 0 20px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity 0.15s,
    background 0.15s,
    transform 0.15s;
}
.omb-auth-btn:active:not(:disabled) {
  transform: translateY(1px);
}
.omb-auth-btn:disabled {
  opacity: 0.7;
  cursor: default;
}
.omb-auth-primary {
  background: var(--omb-accent);
  color: var(--omb-on-accent);
}
.omb-auth-primary:hover:not(:disabled) {
  opacity: 0.88;
}
.omb-auth-white {
  background: var(--omb-surface);
  color: var(--omb-text);
  box-shadow:
    0 1px 2px rgba(17, 17, 17, 0.05),
    0 6px 18px rgba(17, 17, 17, 0.06);
}
.omb-auth-white:hover {
  background: var(--omb-surface-muted);
}

.omb-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  border-radius: 20px;
  background: var(--omb-surface);
  color: var(--omb-text);
  box-shadow: var(--omb-shadow-lift);
}
.omb-demo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
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
