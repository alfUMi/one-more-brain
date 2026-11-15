import { newId, type ItemDto, type ItemStatus } from '@omb/shared'
import type { Ref } from 'vue'
import type { RemindChoice } from '~/utils/remind'

const STATUS_TOAST: Record<Exclude<ItemStatus, 'INBOX'>, string> = {
  KEPT: 'toasts.kept',
  ARCHIVED: 'toasts.archived',
  DONE: 'toasts.done',
}

/**
 * Optimistic item actions on a list, with undo where it matters.
 * `keepsItem(item)` decides whether an item still belongs in the list after a change
 * (the inbox drops triaged items; the library keeps everything).
 */
export function useItemActions(
  items: Ref<ItemDto[]>,
  opts: { keepsItem?: (item: ItemDto) => boolean; onChange?: () => void } = {},
) {
  const { t } = useI18n()
  const toast = useToast()
  const api = useItemsApi()
  const fmt = useFormat()
  const keeps = opts.keepsItem ?? (() => true)

  function replace(updated: ItemDto) {
    const i = items.value.findIndex((x) => x.id === updated.id)
    if (i === -1) return
    if (keeps(updated)) items.value.splice(i, 1, updated)
    else items.value.splice(i, 1)
  }

  function failed() {
    toast.add({ title: t('toasts.saveFailed'), color: 'error' })
  }

  /** Applies `local` right away, then the server copy; rolls back on error. */
  async function mutate(item: ItemDto, local: ItemDto, request: () => Promise<ItemDto>) {
    const index = items.value.findIndex((x) => x.id === item.id)
    replace(local)
    try {
      const saved = await request()
      if (items.value.some((x) => x.id === saved.id)) replace(saved)
      opts.onChange?.()
      return saved
    } catch {
      if (!items.value.some((x) => x.id === item.id)) items.value.splice(index, 0, item)
      else replace(item)
      failed()
      return null
    }
  }

  async function setStatus(item: ItemDto, status: ItemStatus) {
    const previous = item.status
    const saved = await mutate(item, { ...item, status }, () => api.update(item.id, { status }))
    if (!saved || status === 'INBOX') return
    toast.add({
      title: t(STATUS_TOAST[status]),
      duration: 8000,
      actions: [
        {
          label: t('actions.undo'),
          color: 'neutral',
          variant: 'outline',
          onClick: () => void undoStatus(saved, previous),
        },
      ],
    })
  }

  async function undoStatus(item: ItemDto, status: ItemStatus) {
    try {
      const restored = await api.update(item.id, { status })
      if (!items.value.some((x) => x.id === item.id) && keeps(restored)) {
        items.value.unshift(restored)
        items.value.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      } else replace(restored)
      opts.onChange?.()
    } catch {
      failed()
    }
  }

  async function remember(item: ItemDto) {
    const saved = await mutate(item, item, () => api.remember(item.id))
    if (saved) toast.add({ title: t('toasts.remembered') })
  }

  async function remind(item: ItemDto, choice: RemindChoice) {
    try {
      const reminder = await api.addReminder(item.id, {
        id: newId(),
        kind: choice.kind,
        fireAt: choice.fireAt,
        rrule: choice.rrule,
        timezone: fmt.timeZone.value,
      })
      replace({ ...item, reminders: [...item.reminders, reminder] })
      toast.add({ title: t('toasts.reminderSet', { when: fmt.reminder(reminder) }) })
    } catch {
      failed()
    }
  }

  async function acceptReminder(item: ItemDto, id: string) {
    await mutate(
      item,
      {
        ...item,
        reminders: item.reminders.map((r) => (r.id === id ? { ...r, isAiSuggested: false } : r)),
      },
      async () => {
        await api.updateReminder(id, { accept: true })
        return api.get(item.id)
      },
    )
  }

  async function removeReminder(item: ItemDto, id: string) {
    await mutate(
      item,
      { ...item, reminders: item.reminders.filter((r) => r.id !== id) },
      async () => {
        await api.updateReminder(id, { status: 'CANCELLED' })
        return api.get(item.id)
      },
    )
  }

  async function saveBody(item: ItemDto, body: string) {
    await mutate(item, { ...item, body }, () => api.update(item.id, { body }))
  }

  async function addTag(item: ItemDto, name: string) {
    const confirmed = item.tags.filter((x) => !x.suggested).map((x) => x.name)
    if (confirmed.includes(name)) return
    await mutate(
      item,
      {
        ...item,
        tags: [...item.tags.filter((x) => x.name !== name), { name, suggested: false }],
      },
      () => api.update(item.id, { tags: [...confirmed, name] }),
    )
  }

  async function remove(item: ItemDto) {
    const index = items.value.findIndex((x) => x.id === item.id)
    items.value.splice(index, 1)
    try {
      await api.remove(item.id)
      opts.onChange?.()
      toast.add({ title: t('toasts.deleted') })
    } catch {
      items.value.splice(index, 0, item)
      failed()
    }
  }

  return {
    setStatus,
    remember,
    remind,
    acceptReminder,
    removeReminder,
    saveBody,
    addTag,
    remove,
  }
}
