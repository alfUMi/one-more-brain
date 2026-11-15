/** Registers the app's service worker (offline shell + push). In dev it runs without caching. */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration> | null {
  if (!import.meta.client || !('serviceWorker' in navigator)) return null
  const registration = navigator.serviceWorker.register(import.meta.dev ? '/sw.js?dev' : '/sw.js')
  if (!import.meta.dev) {
    // Hand over the assets this page already loaded, so the next start works offline.
    void navigator.serviceWorker.ready.then((reg) => {
      const urls = new Set(
        performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => new URL(u).pathname.startsWith('/_nuxt/')),
      )
      reg.active?.postMessage({ type: 'cache-assets', urls: [...urls] })
    })
  }
  return registration
}
