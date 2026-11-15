import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: { stylistic: false, typescript: true },
})
  .prepend({
    ignores: [
      '**/node_modules/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/dist/**',
      'packages/db/src/generated/**',
      'packages/db/prisma/migrations/**',
      'docs/**',
    ],
  })
  .append({
    // Nuxt pages, layouts and the root component are named by their file path.
    files: ['apps/*/app/pages/**/*.vue', 'apps/*/app/layouts/**/*.vue', 'apps/*/app/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  })
