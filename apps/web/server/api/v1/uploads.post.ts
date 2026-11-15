import { createUploadSchema } from '@omb/shared'

/**
 * Returns a presigned PUT URL for one attachment. The client uploads, then creates the item
 * with the attachment listed; the server checks the object exists before attaching it.
 */
export default defineEventHandler(async (event): Promise<{ url: string; storageKey: string }> => {
  const userId = await requireUserId(event)
  const input = await readValidatedBody(event, (body) => createUploadSchema.parse(body))

  // The item may not exist yet (it is created after the upload), but it must not be someone else's.
  const item = await db.item.findUnique({ where: { id: input.itemId }, select: { userId: true } })
  if (item && item.userId !== userId)
    throw createError({ statusCode: 409, statusMessage: 'Id taken' })

  const key = storageKey(userId, input.itemId, input.attachmentId, input.mime)
  return { url: await presignPut(key, input.mime, input.sizeBytes), storageKey: key }
})
