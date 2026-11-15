import { answerReview, idSchema } from '@omb/shared'
import { z } from 'zod'

const bodySchema = z.object({ gotIt: z.boolean() })

/** "Got it" moves the card one step further; "Forgot" starts it again tomorrow. */
export default defineEventHandler(
  async (event): Promise<{ nextAt: string; step: number; graduated: boolean }> => {
    const userId = await requireUserId(event)
    const itemId = idSchema.parse(getRouterParam(event, 'id'))
    const { gotIt } = await readValidatedBody(event, (body) => bodySchema.parse(body))

    const review = await db.review.findFirst({
      where: { itemId, userId, item: { deletedAt: null } },
    })
    if (!review) throw createError({ statusCode: 404, statusMessage: 'Not in review' })

    const now = new Date()
    const next = answerReview({ step: review.step, lapses: review.lapses }, gotIt, now)
    await db.review.update({
      where: { itemId },
      data: {
        step: next.step,
        lapses: next.lapses,
        nextAt: next.nextAt,
        lastReviewedAt: now,
        graduatedAt: next.graduated ? now : null,
      },
    })
    return { nextAt: next.nextAt.toISOString(), step: next.step, graduated: next.graduated }
  },
)
