<script setup lang="ts">
definePageMeta({ layout: 'settings' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.sections.account')} · ${t('settings.title')}` })

const { user, save } = useProfile()
const { signOut } = useCurrentUser()

const name = ref(user.value?.name ?? '')
watch(
  () => user.value?.name,
  (n) => (name.value = n ?? ''),
)
function saveName() {
  if (name.value.trim() !== (user.value?.name ?? '')) void save({ name: name.value.trim() })
}
</script>

<template>
  <div class="flex max-w-[680px] flex-col gap-[18px]">
    <SettingsHeader :title="t('settings.sections.account')" />

    <section class="omb-card">
      <div class="flex flex-col gap-2">
        <label for="name" class="text-sm font-semibold">{{ t('settings.name') }}</label>
        <UInput
          id="name"
          v-model="name"
          :placeholder="t('settings.namePlaceholder')"
          size="lg"
          class="w-full sm:w-96"
          @blur="saveName"
          @keydown.enter="saveName"
        />
      </div>
      <div class="flex flex-col gap-1 border-t border-(--omb-border-muted) pt-4">
        <span class="text-sm font-semibold">{{ t('settings.email') }}</span>
        <span class="text-sm">{{ user?.email }}</span>
        <span class="omb-hint">{{ t('settings.emailHint') }}</span>
      </div>
    </section>

    <section class="omb-card">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-sm font-semibold">{{ t('settings.signOut') }}</span>
          <span class="omb-hint">{{ t('settings.signOutHint') }}</span>
        </div>
        <UButton color="neutral" variant="outline" icon="i-lucide-log-out" @click="signOut">
          {{ t('settings.signOut') }}
        </UButton>
      </div>
    </section>
  </div>
</template>
