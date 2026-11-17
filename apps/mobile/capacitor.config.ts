/// <reference types="@capacitor/background-runner" />
/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from '@capacitor/cli'

/** A plain-http API (a dev server on the LAN) needs cleartext and mixed content allowed. */
const httpApi = (process.env.VITE_APP_URL ?? 'http://').startsWith('http://')

const config: CapacitorConfig = {
  appId: 'app.onemorebrain.mobile',
  appName: 'One More Brain',
  webDir: 'dist',
  // Live reload while developing: CAP_SERVER_URL=http://<your-ip>:5174 bunx cap run android
  ...(process.env.CAP_SERVER_URL
    ? { server: { url: process.env.CAP_SERVER_URL, cleartext: true } }
    : {}),
  ...(httpApi && !process.env.CAP_SERVER_URL ? { server: { cleartext: true } } : {}),
  android: { allowMixedContent: httpApi },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: '#F5F6F8' },
    Keyboard: { resize: 'native' },
    LocalNotifications: { smallIcon: 'ic_stat_notify', iconColor: '#0F766E' },
    // Background refresh of the notification schedule; see public/runners/background.js.
    BackgroundRunner: {
      label: 'app.onemorebrain.mobile.refresh',
      src: 'runners/background.js',
      event: 'refresh',
      repeat: true,
      interval: 30,
      autoStart: true,
    },
  },
}

export default config
