import { Browser } from '@capacitor/browser'
import { Share } from '@capacitor/share'
import { actionSheetController, alertController } from '@ionic/vue'
import type { ItemDto } from '@omb/shared'
import type { Router } from 'vue-router'
import { removeItem, setStatus } from './actions'
import { formatter, itemTitle } from './format'
import { t } from './i18n'

export async function confirmDelete(): Promise<boolean> {
  const alert = await alertController.create({
    header: t('mobile.item.deleteConfirm'),
    buttons: [
      { text: t('actions.cancel'), role: 'cancel' },
      { text: t('actions.delete'), role: 'destructive' },
    ],
  })
  await alert.present()
  const { role } = await alert.onDidDismiss()
  return role === 'destructive'
}

export async function shareItem(item: ItemDto) {
  const text = [item.title, item.body ?? item.quote].filter(Boolean).join('\n\n')
  await Share.share({
    title: itemTitle(item),
    text: text || undefined,
    url: item.url ?? undefined,
  }).catch(() => undefined)
}

/** "Hold for more" (mockup: Mobile · Hold for more). */
export async function openItemMenu(item: ItemDto, router: Router) {
  const sheet = await actionSheetController.create({
    header: itemTitle(item),
    subHeader: [
      t(`mobile.kind.${item.kind}`),
      t(`sources.${item.source}`),
      formatter.value.relative(item.capturedAt),
    ].join(' · '),
    buttons: [
      ...(item.status === 'INBOX'
        ? [{ text: t('actions.done'), data: 'done' }]
        : [{ text: t('actions.moveToInbox'), data: 'inbox' }]),
      { text: t('mobile.inbox.editText'), data: 'edit' },
      {
        text: `${t('mobile.inbox.tags')}${item.tags.length ? `  ${item.tags.map((x) => `#${x.name}`).join(' ')}` : ''}`,
        data: 'tags',
      },
      ...(item.url ? [{ text: t('mobile.inbox.openLink'), data: 'link' }] : []),
      { text: t('mobile.inbox.share'), data: 'share' },
      { text: t('actions.delete'), role: 'destructive', data: 'delete' },
      { text: t('actions.cancel'), role: 'cancel' },
    ],
  })
  await sheet.present()
  const { data } = await sheet.onDidDismiss<string>()
  switch (data) {
    case 'done':
      await setStatus(item, 'DONE')
      break
    case 'inbox':
      await setStatus(item, 'INBOX')
      break
    case 'edit':
      await router.push({ path: `/item/${item.id}`, query: { edit: '1' } })
      break
    case 'tags':
      await router.push({ path: `/item/${item.id}`, query: { tags: '1' } })
      break
    case 'link':
      if (item.url) await Browser.open({ url: item.url })
      break
    case 'share':
      await shareItem(item)
      break
    case 'delete':
      if (await confirmDelete()) await removeItem(item)
      break
  }
}
