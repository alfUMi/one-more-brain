export default defineAppConfig({
  ui: {
    colors: {
      // Default accent is graphite (black and white); users can switch in Settings → Appearance.
      primary: 'neutral',
      neutral: 'stone',
    },
    // Calm style: pill buttons, soft rounded inputs and menus.
    button: { slots: { base: 'rounded-full' } },
    input: { slots: { base: 'rounded-xl' } },
    select: { slots: { base: 'rounded-xl' } },
    dropdownMenu: { slots: { content: 'rounded-2xl shadow-lg ring-0' } },
    popover: { slots: { content: 'rounded-2xl shadow-lg ring-0' } },
  },
})
