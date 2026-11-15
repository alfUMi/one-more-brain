/** Prepares the storage bucket on startup. Failure is logged, not fatal: everything but uploads still works. */
export default defineNitroPlugin(() => {
  ensureBucket().catch((error: unknown) => {
    console.error('[storage] bucket setup failed:', error instanceof Error ? error.message : error)
  })
})
