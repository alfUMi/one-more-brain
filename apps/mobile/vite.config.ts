import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/** The web app (API) this build talks to: VITE_APP_URL at build time. */
export default defineConfig({
  plugins: [vue()],
  server: { port: 5174, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
})
