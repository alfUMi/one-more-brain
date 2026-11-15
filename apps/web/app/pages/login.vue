<script setup lang="ts">
import { z } from 'zod'
import { authClient } from '~/lib/auth-client'

definePageMeta({ public: true, layout: false })

const { t } = useI18n()
useHead({ title: () => t('auth.title') })

const { data: providers } = await useFetch('/api/v1/auth/providers', {
  default: () => ({ google: false }),
})

const state = reactive({ email: '' })
const schema = z.object({ email: z.email() })
const sentTo = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function sendLink() {
  loading.value = true
  error.value = null
  const { error: err } = await authClient.signIn.magicLink({ email: state.email, callbackURL: '/' })
  loading.value = false
  if (err) error.value = t('auth.error')
  else sentTo.value = state.email
}

async function google() {
  await authClient.signIn.social({ provider: 'google', callbackURL: '/' })
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-(--ui-bg-muted) p-4">
    <UCard class="w-full max-w-sm">
      <div class="flex flex-col gap-6">
        <div class="flex flex-col items-center gap-3 text-center">
          <AppLogo class="size-10" />
          <h1 class="font-display text-2xl font-bold">{{ t('app.name') }}</h1>
          <p class="text-sm text-(--ui-text-muted)">{{ t('auth.subtitle') }}</p>
        </div>

        <div v-if="sentTo" class="flex flex-col items-center gap-3 text-center">
          <UIcon name="i-lucide-mail-check" class="size-8 text-(--ui-primary)" />
          <p class="font-semibold">{{ t('auth.checkEmail') }}</p>
          <p class="text-sm text-(--ui-text-muted)">
            {{ t('auth.checkEmailBody', { email: sentTo }) }}
          </p>
          <UButton variant="link" :label="t('auth.useAnother')" @click="sentTo = null" />
        </div>

        <template v-else>
          <UButton
            v-if="providers.google"
            color="neutral"
            variant="outline"
            icon="i-simple-icons-google"
            :label="t('auth.google')"
            block
            @click="google"
          />
          <USeparator v-if="providers.google" :label="t('auth.or')" />

          <UForm :schema="schema" :state="state" class="flex flex-col gap-3" @submit="sendLink">
            <UFormField :label="t('auth.email')" name="email">
              <UInput
                v-model="state.email"
                type="email"
                autocomplete="email"
                :placeholder="t('auth.emailPlaceholder')"
                class="w-full"
              />
            </UFormField>
            <UButton type="submit" :loading="loading" :label="t('auth.sendLink')" block />
            <p v-if="error" class="text-sm text-(--ui-error)">{{ error }}</p>
          </UForm>
        </template>
      </div>
    </UCard>
  </div>
</template>
