<script setup lang="ts">
/** Stroke icons drawn exactly as in the mockups. */
const props = withDefaults(
  defineProps<{ name: keyof typeof PATHS; size?: number; stroke?: number }>(),
  { size: 20, stroke: 1.8 },
)
</script>

<script lang="ts">
const PATHS = {
  plus: ['M12 5v14M5 12h14'],
  inbox: ['M3 13h5l1.5 3h5L16 13h5', 'M5 5h14l2 8v6H3v-6z'],
  sun: [
    'circle:12,12,4',
    'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  ],
  search: ['circle:11,11,7', 'M20 20l-3.5-3.5'],
  gear: ['circle:12,12,3', 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2'],
  mic: ['rect:9,3,6,11,3', 'M5 11a7 7 0 0 0 14 0M12 18v3'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4z', 'circle:12,13,3.5'],
  link: [
    'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1',
    'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  ],
  check: ['M5 12l5 5L20 7'],
  archive: ['rect:3,4,18,4,1', 'M5 8v11h14V8M10 12h4'],
  clock: ['circle:12,12,9', 'M12 7v5l3 2'],
  repeat: [
    'M4 12a8 8 0 0 1 14-5.3L20 9',
    'M20 4v5h-5',
    'M20 12a8 8 0 0 1-14 5.3L4 15',
    'M4 20v-5h5',
  ],
  highlight: ['M4 20h4l10-10-4-4L4 16z', 'M13 7l4 4'],
  text: ['M5 7h14M5 12h14M5 17h9'],
  image: ['rect:3,5,18,14,2', 'circle:9,10,2', 'M21 16l-5-5-9 8'],
  pin: ['M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z', 'circle:12,9.5,2.5'],
  'chevron-right': ['M9 6l6 6-6 6'],
  'chevron-left': ['M15 6l-6 6 6 6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  x: ['M6 6l12 12M18 6L6 18'],
  trash: ['M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'],
  edit: ['M4 20h4L19 9l-4-4L4 16z'],
  hash: ['M5 9h14M5 15h14M10 4L8 20M16 4l-2 16'],
  external: ['M14 4h6v6M20 4l-9 9M18 14v6H4V6h6'],
  share: ['M4 12v7h16v-7M12 3v12M7 8l5-5 5 5'],
  'circle-check': ['circle:12,12,9', 'M8 12l3 3 5-6'],
  undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
  bell: ['M6 16V11a6 6 0 0 1 12 0v5l2 2H4z', 'M10 21h4'],
  phone: ['rect:7,2,10,20,2', 'M11 18h2'],
  logout: ['M15 4h4v16h-4', 'M10 8l-4 4 4 4M6 12h10'],
} as const
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="props.stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-for="(d, i) in PATHS[props.name]" :key="i">
      <circle
        v-if="d.startsWith('circle:')"
        :cx="d.slice(7).split(',')[0]"
        :cy="d.slice(7).split(',')[1]"
        :r="d.slice(7).split(',')[2]"
      />
      <rect
        v-else-if="d.startsWith('rect:')"
        :x="d.slice(5).split(',')[0]"
        :y="d.slice(5).split(',')[1]"
        :width="d.slice(5).split(',')[2]"
        :height="d.slice(5).split(',')[3]"
        :rx="d.slice(5).split(',')[4]"
      />
      <path v-else :d="d" />
    </template>
  </svg>
</template>
