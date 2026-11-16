import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: { stylistic: false, typescript: true },
})
  .prepend({
    ignores: [
      '**/node_modules/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/.wxt/**',
      '**/dist/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'packages/db/src/generated/**',
      'packages/db/prisma/migrations/**',
      'docs/**',
    ],
  })
  .append({
    // Nuxt pages, layouts and the root component are named by their file path.
    files: [
      'apps/*/app/pages/**/*.vue',
      'apps/*/app/layouts/**/*.vue',
      'apps/*/app/*.vue',
      'apps/extension/entrypoints/**/*.vue',
    ],
    rules: { 'vue/multi-word-component-names': 'off' },
  })
  .append({
    // Ionic's web components use the native `slot` attribute (slot="fixed", slot="bottom").
    files: ['apps/mobile/**/*.vue'],
    rules: { 'vue/no-deprecated-slot-attribute': 'off' },
  })
  .append({
    // Prettier owns formatting; this rule fights it over `<input />`.
    rules: { 'vue/html-self-closing': 'off' },
  })
