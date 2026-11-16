import '@fontsource-variable/inter'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/source-serif-4/400.css'

import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/display.css'
import '@ionic/vue/css/palettes/dark.class.css'
import './styles/app.css'

import { IonicVue } from '@ionic/vue'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './lib/i18n'
import { restoreSession } from './lib/session'
import { router } from './router'

async function start() {
  // The stored session decides the first screen, so read it before routing.
  await restoreSession()
  const app = createApp(App)
    .use(IonicVue, { mode: 'ios', swipeBackEnabled: true })
    .use(i18n)
    .use(router)
  await router.isReady()
  app.mount('#app')
}

void start()
