<script setup lang="ts">
import { ACCENT_COLORS, ACCENT_SOFT, ACCENTS, THEMES, type Accent, type Theme } from '@omb/shared'

definePageMeta({ layout: 'settings' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.sections.appearance')} · ${t('settings.title')}` })

const { user, prefs, save } = useProfile()
const colorMode = useColorMode()

const theme = computed(() => (user.value?.theme ?? 'system') as Theme)
const accent = computed(() => (user.value?.accent ?? 'teal') as Accent)
/** The mode on screen; "system" resolves to the device's current one. */
const shownMode = computed<'light' | 'dark'>(() =>
  theme.value === 'system' ? (colorMode.value === 'dark' ? 'dark' : 'light') : theme.value,
)

// Fixed palettes from the mockup, so the preview shows the choice even before it is applied.
const PALETTE = {
  light: {
    bg: '#F5F6F8',
    surface: '#FFFFFF',
    border: '#E3E5EA',
    text: '#15171C',
    on: '#FFFFFF',
    remBg: '#FFF3E2',
    remText: '#8A4300',
    line: '#D5D8DF',
  },
  dark: {
    bg: '#0F1115',
    surface: '#181B21',
    border: '#2A2F38',
    text: '#E8EAEE',
    on: '#0F1115',
    remBg: '#3A2A12',
    remText: '#FFC97A',
    line: '#2A2F38',
  },
} as const

const preview = computed(() => ({
  ...PALETTE[shownMode.value],
  accent: ACCENT_COLORS[accent.value][shownMode.value],
  soft: ACCENT_SOFT[accent.value][shownMode.value],
}))
const previewLabel = computed(() =>
  theme.value === 'system'
    ? t('settings.previewSystem', { mode: t(`settings.previewModes.${shownMode.value}`) })
    : t(`settings.themes.${theme.value}`),
)

const themeCards = computed(() =>
  THEMES.map((id) => ({
    id,
    sides: (id === 'light'
      ? ['light', 'light']
      : id === 'dark'
        ? ['dark', 'dark']
        : ['light', 'dark']
    ).map((mode) => ({
      bg: PALETTE[mode as 'light'].bg,
      line: PALETTE[mode as 'light'].line,
      accent: ACCENT_COLORS[accent.value][mode as 'light'],
    })),
  })),
)

/** Swatches use the shade for the mode on screen, so Graphite stays visible in dark mode. */
const swatch = (id: Accent) => ACCENT_COLORS[id][colorMode.value === 'dark' ? 'dark' : 'light']

const choice = (selected: boolean) => [
  'rounded-[14px] bg-(--omb-surface) text-left transition-colors',
  selected
    ? 'border-2 border-(--omb-accent)'
    : 'border border-(--omb-border) hover:border-(--omb-text-muted)',
]
</script>

<template>
  <div class="flex flex-wrap items-start gap-6">
    <div class="flex max-w-[680px] min-w-0 flex-[999_1_460px] flex-col gap-[18px]">
      <SettingsHeader :title="t('settings.sections.appearance')" :hint="t('settings.synced')" />

      <section class="omb-card" aria-labelledby="theme-h">
        <div class="flex flex-col gap-1">
          <h3 id="theme-h" class="text-sm font-semibold">{{ t('settings.theme') }}</h3>
          <span class="omb-hint">{{ t('settings.themeHint') }}</span>
        </div>
        <div role="radiogroup" aria-labelledby="theme-h" class="grid grid-cols-3 gap-2.5">
          <button
            v-for="card in themeCards"
            :key="card.id"
            type="button"
            role="radio"
            :aria-checked="theme === card.id"
            :class="[
              choice(theme === card.id),
              'flex flex-col gap-2.5 p-2.5 text-sm font-semibold',
            ]"
            @click="save({ theme: card.id })"
          >
            <span
              aria-hidden="true"
              class="flex h-16 overflow-hidden rounded-[9px] border border-(--omb-border)"
            >
              <span
                v-for="(side, i) in card.sides"
                :key="i"
                class="flex flex-1 flex-col gap-[5px] p-2"
                :style="{ background: side.bg }"
              >
                <span class="h-1.5 w-3/5 rounded-[3px]" :style="{ background: side.line }" />
                <span class="h-1.5 w-4/5 rounded-[3px]" :style="{ background: side.line }" />
                <span class="h-2.5 w-2/5 rounded-[3px]" :style="{ background: side.accent }" />
              </span>
            </span>
            {{ t(`settings.themes.${card.id}`) }}
          </button>
        </div>
      </section>

      <section class="omb-card" aria-labelledby="accent-h">
        <div class="flex flex-col gap-1">
          <h3 id="accent-h" class="text-sm font-semibold">{{ t('settings.accent') }}</h3>
          <span class="omb-hint">{{ t('settings.accentHint') }}</span>
        </div>
        <div
          role="radiogroup"
          aria-labelledby="accent-h"
          class="grid grid-cols-3 gap-2.5 sm:grid-cols-5"
        >
          <button
            v-for="id in ACCENTS"
            :key="id"
            type="button"
            role="radio"
            :aria-checked="accent === id"
            :class="[
              choice(accent === id),
              'flex flex-col items-center gap-2 px-1.5 py-3 text-[13px] font-medium',
            ]"
            @click="save({ accent: id })"
          >
            <span
              aria-hidden="true"
              class="flex size-10 items-center justify-center rounded-full"
              :style="{
                background: swatch(id),
                boxShadow:
                  accent === id ? `0 0 0 3px var(--omb-surface), 0 0 0 5px ${swatch(id)}` : 'none',
              }"
            >
              <UIcon
                v-if="accent === id"
                name="i-lucide-check"
                class="size-[18px] text-(--omb-on-accent)"
              />
            </span>
            {{ t(`settings.accents.${id}`) }}
          </button>
        </div>
      </section>

      <section class="omb-card gap-3.5!" aria-labelledby="more-h">
        <h3 id="more-h" class="text-sm font-semibold">{{ t('settings.more') }}</h3>
        <label class="flex cursor-pointer items-center gap-3">
          <UCheckbox
            :model-value="prefs.keyboardHints"
            @update:model-value="save({ prefs: { keyboardHints: Boolean($event) } })"
          />
          <span class="flex flex-col">
            <span class="text-sm font-medium">{{ t('settings.keyboardHints') }}</span>
            <span class="omb-hint">{{ t('settings.keyboardHintsHint') }}</span>
          </span>
        </label>
        <label class="flex cursor-pointer items-center gap-3">
          <UCheckbox
            :model-value="prefs.compactCards"
            @update:model-value="save({ prefs: { compactCards: Boolean($event) } })"
          />
          <span class="flex flex-col">
            <span class="text-sm font-medium">{{ t('settings.compactCards') }}</span>
            <span class="omb-hint">{{ t('settings.compactCardsHint') }}</span>
          </span>
        </label>
      </section>
    </div>

    <aside
      :aria-label="t('settings.preview')"
      class="flex max-w-[420px] min-w-0 flex-[1_1_320px] flex-col gap-2.5"
    >
      <span class="text-xs font-semibold tracking-[0.08em] text-(--omb-text-muted) uppercase">
        {{ t('settings.preview') }} · {{ previewLabel }}
      </span>
      <div
        class="flex flex-col gap-3 rounded-[18px] border p-[18px]"
        :style="{ background: preview.bg, borderColor: preview.border, color: preview.text }"
      >
        <div
          class="flex h-9 items-center rounded-[9px] px-3 text-sm font-semibold"
          :style="{ background: preview.soft, color: preview.accent }"
        >
          {{ t('nav.inbox') }}<span class="ml-auto text-xs">7</span>
        </div>
        <div
          class="flex flex-col gap-2.5 rounded-[14px] px-3.5 py-3"
          :style="{ background: preview.surface, border: `2px solid ${preview.accent}` }"
        >
          <span class="text-[15px] font-medium">{{ t('settings.previewNote') }}</span>
          <div class="flex items-center gap-1.5">
            <span
              class="inline-flex h-6 items-center rounded-full px-[9px] text-xs font-medium"
              :style="{ background: preview.remBg, color: preview.remText }"
            >
              {{ t('settings.previewReminder') }}
            </span>
            <span class="flex-1" />
            <span
              class="inline-flex h-[30px] items-center rounded-lg px-3 text-[13px] font-bold"
              :style="{ background: preview.accent, color: preview.on }"
            >
              {{ t('inbox.save') }}
            </span>
          </div>
        </div>
        <div
          class="flex flex-col gap-2.5 rounded-[14px] px-3.5 py-3"
          :style="{ background: preview.surface, border: `1px solid ${preview.border}` }"
        >
          <span class="text-[14.5px]">{{ t('settings.previewTriage') }}</span>
          <div class="flex gap-1.5">
            <span
              class="flex h-8 flex-1 items-center justify-center rounded-lg text-[13px] font-bold"
              :style="{ background: preview.accent, color: preview.on }"
            >
              {{ t('actions.keep') }}
            </span>
            <span
              class="flex h-8 flex-1 items-center justify-center rounded-lg text-[13px] font-medium"
              :style="{ border: `1px solid ${preview.border}` }"
            >
              {{ t('actions.archive') }}
            </span>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
