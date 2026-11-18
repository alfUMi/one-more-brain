<script setup lang="ts">
import type { ExtensionExternalMessage } from '@omb/shared'

definePageMeta({ layout: false })

const { t } = useI18n()
useHead({ title: () => t('auth.extension.title') })

const route = useRoute()
const config = useRuntimeConfig()
const { user } = useCurrentUser()

/** The extension opens this page with its own id; only allow-listed ids get a token. */
const extensionId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''))
const allowed = computed(() =>
  String(config.public.extensionIds ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(extensionId.value),
)

type State = 'ready' | 'sending' | 'done' | 'missing'
const state = ref<State>('ready')

const isMac = import.meta.client && /Mac|iPhone|iPad/.test(navigator.platform)
const keys = isMac ? '⌘ ⇧ K' : 'Ctrl + Shift + K'

interface ChromeRuntime {
  sendMessage(
    id: string,
    message: ExtensionExternalMessage,
    callback: (reply: unknown) => void,
  ): void
  lastError?: { message?: string }
}

/** `chrome.runtime` exists on this page only when an installed extension lists it as connectable. */
function send(message: ExtensionExternalMessage): Promise<boolean> {
  const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime
  if (!runtime?.sendMessage) return Promise.resolve(false)
  return new Promise((resolve) => {
    try {
      runtime.sendMessage(extensionId.value, message, (reply) => {
        resolve(!runtime.lastError && (reply as { ok?: boolean } | undefined)?.ok === true)
      })
    } catch {
      resolve(false)
    }
  })
}

async function connect() {
  state.value = 'sending'
  if (!(await send({ type: 'omb:ping' }))) {
    state.value = 'missing'
    return
  }
  try {
    const { token } = await $fetch<{ token: string }>('/api/v1/auth/extension-token', {
      method: 'POST',
    })
    state.value = (await send({ type: 'omb:token', token })) ? 'done' : 'missing'
  } catch {
    state.value = 'missing'
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-(--omb-bg) px-4 py-10">
    <main class="omb-card w-full max-w-[460px] gap-6! p-8!">
      <div class="flex items-center gap-2.5">
        <AppLogo class="size-8" />
        <span class="text-base font-semibold">{{ t('app.name') }}</span>
      </div>

      <template v-if="state === 'done'">
        <span
          class="flex size-12 items-center justify-center rounded-full bg-(--omb-chip) text-(--omb-text)"
        >
          <UIcon name="i-lucide-check" class="size-6" />
        </span>
        <div class="flex flex-col gap-2">
          <h1 class="text-2xl font-semibold">{{ t('auth.extension.doneTitle') }}</h1>
          <p class="omb-hint m-0 text-sm!">{{ t('auth.extension.doneBody', { keys }) }}</p>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-col gap-2">
          <h1 class="text-2xl font-semibold">{{ t('auth.extension.title') }}</h1>
          <p class="omb-hint m-0 text-sm!">
            {{ t('auth.extension.body', { email: user?.email ?? '' }) }}
          </p>
        </div>
        <p v-if="!allowed" role="alert" class="m-0 text-sm text-(--ui-error)">
          {{ t('auth.extension.unknown') }}
        </p>
        <p v-else-if="state === 'missing'" role="alert" class="m-0 text-sm text-(--ui-error)">
          {{ t('auth.extension.missing') }}
        </p>
        <UButton
          block
          size="lg"
          :loading="state === 'sending'"
          :disabled="!allowed"
          @click="connect"
        >
          {{ t('auth.extension.connect') }}
        </UButton>
      </template>
    </main>
  </div>
</template>
