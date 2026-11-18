<script setup lang="ts">
import { mobileChallengeSchema, MOBILE_SCHEME } from '@omb/shared'

definePageMeta({ layout: false })

const { t } = useI18n()
useHead({ title: () => t('auth.mobile.title') })

const route = useRoute()
const { user } = useCurrentUser()

/** The app opens this page with the SHA-256 challenge of a secret only it knows. */
const challenge = computed(() => {
  const parsed = mobileChallengeSchema.safeParse(route.query.challenge)
  return parsed.success ? parsed.data : null
})

type State = 'working' | 'ready' | 'failed'
const state = ref<State>('working')
const appLink = ref<string | null>(null)

onMounted(async () => {
  if (!challenge.value) return
  try {
    const { code } = await $fetch<{ code: string }>('/api/v1/auth/mobile-code', {
      method: 'POST',
      body: { challenge: challenge.value },
    })
    appLink.value = `${MOBILE_SCHEME}://auth?code=${encodeURIComponent(code)}`
    state.value = 'ready'
    window.location.href = appLink.value
  } catch {
    state.value = 'failed'
  }
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-(--omb-bg) px-4 py-10">
    <main class="omb-card w-full max-w-[460px] gap-6! p-8!">
      <div class="flex items-center gap-2.5">
        <AppLogo class="size-8" />
        <span class="text-base font-semibold">{{ t('app.name') }}</span>
      </div>
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-semibold">{{ t('auth.mobile.title') }}</h1>
        <p class="omb-hint m-0 text-sm!">
          {{ t('auth.mobile.body', { email: user?.email ?? '' }) }}
        </p>
      </div>
      <p v-if="!challenge" role="alert" class="m-0 text-sm text-(--ui-error)">
        {{ t('auth.mobile.invalid') }}
      </p>
      <p v-else-if="state === 'failed'" role="alert" class="m-0 text-sm text-(--ui-error)">
        {{ t('auth.mobile.failed') }}
      </p>
      <template v-else>
        <UButton
          block
          size="lg"
          :loading="state === 'working'"
          :disabled="!appLink"
          :to="appLink ?? undefined"
          external
        >
          {{ state === 'working' ? t('auth.mobile.opening') : t('auth.mobile.open') }}
        </UButton>
        <p class="omb-hint m-0">{{ t('auth.mobile.hint') }}</p>
      </template>
    </main>
  </div>
</template>
