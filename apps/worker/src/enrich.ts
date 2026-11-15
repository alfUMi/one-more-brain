import { aiConfigured, enrich, type EnrichInput } from '@omb/ai'
import { AI_JOB_OPTIONS, type AiEnrichJob, type PrismaClient } from '@omb/db'
import { newId } from '@omb/shared'
import { getObjectBytes } from '@omb/storage'
import type { Job } from 'pg-boss'
import { log } from './log'

/** Monthly AI token allowance per user (input + output). Haiku-class pricing makes this a few cents. */
const MONTHLY_TOKENS = Number(process.env.AI_MONTHLY_TOKENS ?? 2_000_000)
/** Claude accepts images up to 5 MB; at most 3 per item keeps requests small. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGES = 3

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7)
}

/** pg-boss handler: enriches each item; on the last failed attempt marks it FAILED instead of throwing. */
export function aiEnrich(db: PrismaClient) {
  return async (jobs: Job<AiEnrichJob>[]) => {
    for (const job of jobs) {
      try {
        await enrichItem(db, job.data.itemId)
      } catch (error) {
        log.error('ai.enrich failed', {
          itemId: job.data.itemId,
          attempt: job.retryCount,
          error: error instanceof Error ? error.message : String(error),
        })
        if (job.retryCount < AI_JOB_OPTIONS.retryLimit) throw error
        await db.item.updateMany({ where: { id: job.data.itemId }, data: { aiStatus: 'FAILED' } })
      }
    }
  }
}

export async function enrichItem(db: PrismaClient, itemId: string, now = new Date()) {
  const item = await db.item.findUnique({
    where: { id: itemId },
    include: {
      attachments: { where: { deletedAt: null, kind: { in: ['IMAGE', 'SCREENSHOT'] } } },
      reminders: { where: { deletedAt: null, status: { in: ['ACTIVE', 'FIRED'] } } },
      user: { select: { timezone: true, locale: true, aiTokensMonth: true, aiMonth: true } },
    },
  })
  if (!item || item.deletedAt) return

  const skip = async (reason: string) => {
    await db.item.update({ where: { id: itemId }, data: { aiStatus: 'SKIPPED' } })
    log.info('ai.enrich skipped', { itemId, reason })
  }
  if (!aiConfigured()) return skip('no api key')
  const month = monthKey(now)
  const used = item.user.aiMonth === month ? item.user.aiTokensMonth : 0
  if (used >= MONTHLY_TOKENS) return skip('monthly budget used')

  const tags = await db.tag.findMany({
    where: { userId: item.userId, deletedAt: null },
    select: { name: true },
    orderBy: { items: { _count: 'desc' } },
    take: 100,
  })
  const images: EnrichInput['images'] = []
  for (const a of item.attachments
    .filter((a) => a.sizeBytes <= MAX_IMAGE_BYTES)
    .slice(0, MAX_IMAGES)) {
    images.push({
      mime: a.mime as EnrichInput['images'][number]['mime'],
      bytes: await getObjectBytes(a.storageKey),
    })
  }

  const result = await enrich({
    kind: item.kind,
    title: item.titleIsAi ? null : item.title,
    body: item.body,
    quote: item.quote,
    url: item.url,
    pageTitle: item.pageTitle,
    images,
    existingTags: tags.map((t) => t.name),
    hasReminder: item.reminders.length > 0,
    now,
    timeZone: item.user.timezone,
    locale: item.user.locale,
  })
  if (!result) return skip('declined')

  await db.$transaction(async (tx) => {
    // The user may have edited the item while the model was working; never overwrite their title.
    const current = await tx.item.findUnique({
      where: { id: itemId },
      select: { title: true, titleIsAi: true, deletedAt: true },
    })
    if (!current || current.deletedAt) return
    const titleIsMine = current.title !== null && !current.titleIsAi

    await tx.item.update({
      where: { id: itemId },
      data: {
        ...(!titleIsMine && { title: result.title, titleIsAi: result.title !== null }),
        extractedText: result.imageText,
        language: result.language,
        aiStatus: 'DONE',
      },
    })

    // Replace earlier suggestions; confirmed tags stay as they are.
    await tx.itemTag.deleteMany({ where: { itemId, suggested: true } })
    for (const name of result.tags) {
      const tag = await tx.tag.upsert({
        where: { userId_name: { userId: item.userId, name } },
        create: { userId: item.userId, name },
        update: {},
        select: { id: true },
      })
      await tx.itemTag.upsert({
        where: { itemId_tagId: { itemId, tagId: tag.id } },
        create: { itemId, tagId: tag.id, suggested: true },
        update: {},
      })
    }

    if (result.reminder) {
      const existing = await tx.reminder.count({
        where: { itemId, deletedAt: null, status: { in: ['ACTIVE', 'FIRED'] } },
      })
      if (!existing) {
        await tx.reminder.create({
          data: {
            id: newId(),
            userId: item.userId,
            itemId,
            kind: result.reminder.rrule ? 'RECURRING' : 'TIME',
            fireAt: result.reminder.fireAt,
            rrule: result.reminder.rrule,
            timezone: item.user.timezone,
            isAiSuggested: true,
          },
        })
      }
    }

    await tx.user.update({
      where: { id: item.userId },
      data: {
        aiMonth: month,
        aiTokensMonth: used + result.usage.inputTokens + result.usage.outputTokens,
      },
    })
  })
  log.info('ai.enrich done', {
    itemId,
    tokens: result.usage.inputTokens + result.usage.outputTokens,
    tags: result.tags.length,
    reminder: Boolean(result.reminder),
  })
}
