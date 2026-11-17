import { Haptics, ImpactStyle } from '@capacitor/haptics'
import {
  newId,
  type ItemDto,
  type ItemStatus,
  type ReminderDto,
  type SnoozePreset,
} from '@omb/shared'
import { remindersChanged } from './changes'
import { isNative } from './config'
import { formatter } from './format'
import { t } from './i18n'
import { api } from './session'
import { dropItem, loadToday, upsertItem } from './store'
import { saveFailed, toast } from './toast'

/** A reminder picked in the UI, before it gets an id. */
export interface RemindChoice {
  kind: 'TIME' | 'RECURRING'
  fireAt: Date
  rrule?: string
}

const STATUS_TOAST: Record<Exclude<ItemStatus, 'INBOX'>, string> = {
  KEPT: 'toasts.kept',
  ARCHIVED: 'toasts.archived',
  DONE: 'toasts.done',
}

export function tap(style: ImpactStyle = ImpactStyle.Light) {
  if (isNative) void Haptics.impact({ style }).catch(() => undefined)
}

/** Keep / Archive / Done / back to Inbox, shown at once, with Undo. */
export async function setStatus(item: ItemDto, status: ItemStatus): Promise<ItemDto | null> {
  const previous = item.status
  upsertItem({ ...item, status })
  tap(status === 'KEPT' ? ImpactStyle.Medium : ImpactStyle.Light)
  try {
    const saved = await api.update(item.id, { status })
    upsertItem(saved)
    remindersChanged()
    if (status !== 'INBOX') {
      void toast(t(STATUS_TOAST[status]), {
        undo: () =>
          void api.update(item.id, { status: previous }).then(upsertItem).catch(saveFailed),
      })
    }
    return saved
  } catch {
    upsertItem(item)
    void saveFailed()
    return null
  }
}

export async function remember(item: ItemDto): Promise<ItemDto | null> {
  try {
    const saved = await api.remember(item.id)
    upsertItem(saved)
    tap()
    void toast(t('toasts.remembered'))
    void loadToday()
    return saved
  } catch {
    void saveFailed()
    return null
  }
}

export async function remind(item: ItemDto, choice: RemindChoice): Promise<ItemDto | null> {
  try {
    const reminder = await api.addReminder(item.id, {
      id: newId(),
      kind: choice.kind,
      fireAt: choice.fireAt,
      rrule: choice.rrule,
      timezone: formatter.value.timeZone,
    })
    const saved = { ...item, reminders: [...item.reminders, reminder] }
    upsertItem(saved)
    remindersChanged()
    tap()
    void toast(t('toasts.reminderSet', { when: formatter.value.reminder(reminder) }))
    void loadToday()
    return saved
  } catch {
    void saveFailed()
    return null
  }
}

async function refetch(item: ItemDto): Promise<ItemDto> {
  const fresh = await api.get(item.id)
  upsertItem(fresh)
  remindersChanged()
  void loadToday()
  return fresh
}

export async function acceptReminder(item: ItemDto, reminder: ReminderDto) {
  try {
    await api.updateReminder(reminder.id, { accept: true })
    return await refetch(item)
  } catch {
    void saveFailed()
    return null
  }
}

export async function removeReminder(item: ItemDto, reminder: ReminderDto) {
  try {
    await api.updateReminder(reminder.id, { status: 'CANCELLED' })
    return await refetch(item)
  } catch {
    void saveFailed()
    return null
  }
}

export async function saveBody(item: ItemDto, body: string): Promise<ItemDto | null> {
  try {
    const saved = await api.update(item.id, { body: body.trim() ? body : null })
    upsertItem(saved)
    // The title in its notifications comes from the text.
    remindersChanged()
    return saved
  } catch {
    void saveFailed()
    return null
  }
}

/** Sets the confirmed tags (AI suggestions not in the list are dropped). */
export async function setTags(item: ItemDto, tags: string[]): Promise<ItemDto | null> {
  try {
    const saved = await api.update(item.id, { tags })
    upsertItem(saved)
    return saved
  } catch {
    void saveFailed()
    return null
  }
}

export async function removeItem(item: ItemDto): Promise<boolean> {
  dropItem(item.id)
  try {
    await api.remove(item.id)
    remindersChanged()
    void toast(t('toasts.deleted'))
    void loadToday()
    return true
  } catch {
    upsertItem(item)
    void saveFailed()
    return false
  }
}

export async function reminderDone(reminderId: string) {
  try {
    await api.updateReminder(reminderId, { status: 'DONE' })
    remindersChanged()
    tap(ImpactStyle.Medium)
    void toast(t('today.markedDone'))
  } catch {
    void saveFailed()
  }
  await loadToday()
}

export async function snooze(reminderId: string, preset: SnoozePreset) {
  try {
    const r = await api.snooze(reminderId, { preset })
    remindersChanged()
    tap()
    void toast(t('today.snoozed', { when: formatter.value.when(r.fireAt ?? new Date()) }))
  } catch {
    void saveFailed()
  }
  await loadToday()
}
