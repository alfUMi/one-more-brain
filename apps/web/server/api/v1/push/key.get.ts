/** VAPID public key the browser needs to subscribe. Null when push isn't configured. */
export default defineEventHandler(async (event): Promise<{ publicKey: string | null }> => {
  await requireUserId(event)
  return { publicKey: process.env.VAPID_PUBLIC_KEY || null }
})
