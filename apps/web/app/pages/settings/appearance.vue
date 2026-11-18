<script setup lang="ts">
import {
  ACCENT_COLORS,
  ACCENT_SOFT,
  ACCENTS,
  DEFAULT_ACCENT,
  THEMES,
  type Accent,
  type Theme,
} from '@omb/shared'

definePageMeta({ layout: 'settings' })
const { t } = useI18n()
useHead({ title: () => `${t('settings.sections.appearance')} · ${t('settings.title')}` })

const { user, prefs, save } = useProfile()
const colorMode = useColorMode()

const theme = computed(() => (user.value?.theme ?? 'system') as Theme)
const accent = computed(() => (user.value?.accent ?? DEFAULT_ACCENT) as Accent)
/** The mode on screen; "system" resolves to the device's current one. */
const shownMode = computed<'light' | 'dark'>(() =>
  theme.value === 'system' ? (colorMode.value === 'dark' ? 'dark' : 'light') : theme.value,
)

// Fixed palettes from the mockup, so the preview shows the choice even before it is applied.
const PALETTE = {
  light: {
    bg: '#F1F1EE',
    surface: '#FFFFFF',
    border: '#E3E3DF',
    text: '#111111',
    on: '#FFFFFF',
    remBg: '#FBF6EE',
    remText: '#8A4B00',
    line: '#E3E3DF',
  },
  dark: {
    bg: '#121212',
    surface: '#1C1C1C',
    border: '#2C2C2C',
    text: '#EDEDEB',
    on: '#121212',
    remBg: '#2A2116',
    remText: '#F3B866',
    line: '#2C2C2C',
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
  'rounded-2xl bg-(--omb-surface) text-left transition-shadow',
  selected
    ? 'ring-2 ring-(--omb-accent)'
    : 'ring-1 ring-(--omb-border) hover:ring-(--omb-text-muted)',
]
</script>

<template>
  <div class="flex flex-col gap-5">
    <SettingsHeader :title="t('settings.sections.appearance')" />

    <section
      :aria-label="t('settings.preview')"
      class="flex flex-col gap-2.5 rounded-[20px] p-[18px] transition-colors"
      :style="{ background: preview.bg, color: preview.text }"
    >
      <span class="text-[12.5px] opacity-70">{{ t('settings.preview') }} · {{ previewLabel }}</span>
      <div
        class="flex flex-col gap-2.5 rounded-2xl px-4 py-3.5"
        :style="{ background: preview.surface }"
      >
        <span class="text-[15px]">{{ t('settings.previewNote') }}</span>
        <div class="flex items-center gap-2">
          <span
            class="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs"
            :style="{ background: preview.remBg, color: preview.remText }"
          >
            <span class="size-1.5 rounded-full" :style="{ background: 'currentColor' }" />
            {{ t('settings.previewReminder') }}
          </span>
          <span class="flex-1" />
          <span
            class="inline-flex h-8 items-center rounded-full px-4 text-[13px] font-semibold"
            :style="{ background: preview.accent, color: preview.on }"
          >
            {{ t('inbox.save') }}
          </span>
        </div>
      </div>
    </section>

    <section class="omb-card" aria-labelledby="theme-h">
      <div class="flex flex-col gap-[3px]">
        <h3 id="theme-h" class="text-[15.5px] font-semibold">{{ t('settings.theme') }}</h3>
        <span class="omb-hint">{{ t('settings.themeHint') }}</span>
      </div>
      <div role="radiogroup" aria-labelledby="theme-h" class="grid grid-cols-3 gap-2.5">
        <button
          v-for="card in themeCards"
          :key="card.id"
          type="button"
          role="radio"
          :aria-checked="theme === card.id"
          :class="[choice(theme === card.id), 'flex flex-col gap-2.5 p-2.5 text-sm font-medium']"
          @click="save({ theme: card.id })"
        >
          <span aria-hidden="true" class="flex h-[60px] overflow-hidden rounded-[10px]">
            <span
              v-for="(side, i) in card.sides"
              :key="i"
              class="flex flex-1 flex-col gap-[5px] p-2"
              :style="{ background: side.bg }"
            >
              <span class="h-1.5 w-3/5 rounded-full" :style="{ background: side.line }" />
              <span class="h-1.5 w-4/5 rounded-full" :style="{ background: side.line }" />
              <span class="h-2.5 w-2/5 rounded-full" :style="{ background: side.accent }" />
            </span>
          </span>
          {{ t(`settings.themes.${card.id}`) }}
        </button>
      </div>
    </section>

    <section class="omb-card" aria-labelledby="accent-h">
      <div class="flex flex-col gap-[3px]">
        <h3 id="accent-h" class="text-[15.5px] font-semibold">{{ t('settings.accent') }}</h3>
        <span class="omb-hint">{{ t('settings.accentHint') }}</span>
      </div>
      <div role="radiogroup" aria-labelledby="accent-h" class="flex flex-wrap gap-[18px]">
        <button
          v-for="id in ACCENTS"
          :key="id"
          type="button"
          role="radio"
          :aria-checked="accent === id"
          class="flex flex-col items-center gap-2 text-[12.5px] font-medium text-(--omb-text-toned)"
          @click="save({ accent: id })"
        >
          <span
            aria-hidden="true"
            class="size-[38px] rounded-full"
            :style="{
              background: swatch(id),
              boxShadow:
                accent === id ? `0 0 0 3px var(--omb-surface), 0 0 0 5px ${swatch(id)}` : 'none',
            }"
          />
          {{ t(`settings.accents.${id}`) }}
        </button>
      </div>
    </section>

    <section class="omb-card gap-3.5!" aria-labelledby="more-h">
      <h3 id="more-h" class="text-[15.5px] font-semibold">{{ t('settings.more') }}</h3>
      <label class="flex cursor-pointer items-center gap-3">
        <UCheckbox
          :model-value="prefs.keyboardHints"
          @update:model-value="save({ prefs: { keyboardHints: Boolean($event) } })"
        />
        <span class="flex flex-col">
          <span class="text-[14.5px]">{{ t('settings.keyboardHints') }}</span>
          <span class="omb-hint">{{ t('settings.keyboardHintsHint') }}</span>
        </span>
      </label>
      <label class="flex cursor-pointer items-center gap-3">
        <UCheckbox
          :model-value="prefs.compactCards"
          @update:model-value="save({ prefs: { compactCards: Boolean($event) } })"
        />
        <span class="flex flex-col">
          <span class="text-[14.5px]">{{ t('settings.compactCards') }}</span>
          <span class="omb-hint">{{ t('settings.compactCardsHint') }}</span>
        </span>
      </label>
    </section>
  </div>
</template>
