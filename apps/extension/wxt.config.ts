import { defineConfig } from 'wxt'

/** The web app this build talks to (WXT_APP_URL at build time). */
const appUrl = new URL(process.env.WXT_APP_URL ?? 'http://localhost:3000')
/** Match patterns ignore the port. */
const appMatch = `${appUrl.protocol}//${appUrl.hostname}/*`

/**
 * Public half of a throwaway key, so unpacked builds always get the id
 * `ealahabaammegndodbgendfkinpnflae` (the web app's default allow-list). Store builds set WXT_NO_KEY=1.
 */
const DEV_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz6mzgeSKZXkKt4Qmpgvl1R4HFmi9knlqd+s6TJSLxjDogsgTwwVlFpkXFeFZ0CcDsIUsLHDQGkyvS0RVPRMmKy/rVryGU3vvMyxrrtpX/tefwKmzcrZ7/qcz9R2ncqAyILz/r2AGjitv95mBpxOl7gPGKgwQyNy1wTcjf+2Bh+W/Yy9Q/efF6R0L1jZ0ST3TQZVIfYq6s4SCx9p6T4qJCUm6dRSp4F3RM8Q2KplrySVXjQFcwXY9fjF8ak4imexoUrZ7RcRQD/4DCK0yd3KVs6OLXRiuiWpA6EIs2DgmI7xKdChHSuDLOaVHNzySGy8ANoZLut40GpZY/b0VgPVGcwIDAQAB'

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  zip: { artifactTemplate: 'one-more-brain-extension-{{version}}-{{browser}}.zip' },
  vite: () => ({ define: { __APP_URL__: JSON.stringify(appUrl.origin) } }),
  manifest: {
    name: 'One More Brain',
    description: 'Save highlights, pages, images and screenshots to your second brain.',
    ...(process.env.WXT_NO_KEY ? {} : { key: DEV_KEY }),
    permissions: ['contextMenus', 'storage', 'activeTab', 'scripting', 'notifications', 'alarms'],
    host_permissions: [appMatch],
    externally_connectable: { matches: [appMatch] },
    action: { default_title: 'Quick capture' },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' },
        description: 'Quick capture',
      },
    },
  },
})
