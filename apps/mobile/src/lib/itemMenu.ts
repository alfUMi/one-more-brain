import { Browser } from '@capacitor/browser'
import { Share } from '@capacitor/share'
import { actionSheetController, alertController } from '@ionic/vue'
import type { ItemDto } from '@omb/shared'
import type { Router } from 'vue-router'
import { removeItem, setStatus } from './actions'
import { displayTitle, formatter, itemTitle, titleIsQuote } from './format'
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

/** A stroke icon for an action sheet row, drawn like AppIcon. */
function sheetIcon(paths: string[]): string {
  const shapes = paths
    .map((d) =>
      d.startsWith('circle:')
        ? `<circle cx="${d.slice(7).split(',')[0]}" cy="${d.slice(7).split(',')[1]}" r="${d.slice(7).split(',')[2]}"/>`
        : `<path d="${d}"/>`,
    )
    .join('')
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`
}

const ICONS = {
  done: sheetIcon(['circle:12,12,9', 'M8 12l3 3 5-6']),
  inbox: sheetIcon(['M3 13h5l1.5 3h5L16 13h5', 'M5 5h14l2 8v6H3v-6z']),
  edit: sheetIcon(['M4 20h4L19 9l-4-4L4 16z']),
  tags: sheetIcon(['M5 9h14M5 15h14M10 4L8 20M16 4l-2 16']),
  link: sheetIcon(['M14 4h6v6M20 4l-9 9M18 14v6H4V6h6']),
  share: sheetIcon(['M4 12v7h16v-7M12 3v12M7 8l5-5 5 5']),
  delete: sheetIcon(['M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3']),
}

/** "Hold for more" (mockup: Mobile · Hold for more). */
export async function openItemMenu(item: ItemDto, router: Router) {
  const sheet = await actionSheetController.create({
    cssClass: titleIsQuote(item) ? 'omb-quote-title' : undefined,
    header: displayTitle(item),
    subHeader: [
      t(`mobile.kind.${item.kind}`),
      t(`sources.${item.source}`),
      formatter.value.relative(item.capturedAt),
    ].join(' · '),
    buttons: [
      ...(item.status === 'INBOX'
        ? [{ text: t('actions.done'), data: 'done', icon: ICONS.done }]
        : [{ text: t('actions.moveToInbox'), data: 'inbox', icon: ICONS.inbox }]),
      { text: t('mobile.inbox.editText'), data: 'edit', icon: ICONS.edit },
      {
        text: `${t('mobile.inbox.tags')}${item.tags.length ? ` · ${item.tags.map((x) => x.name).join(', ')}` : ''}`,
        data: 'tags',
        icon: ICONS.tags,
      },
      ...(item.url ? [{ text: t('mobile.inbox.openLink'), data: 'link', icon: ICONS.link }] : []),
      { text: t('mobile.inbox.share'), data: 'share', icon: ICONS.share },
      { text: t('actions.delete'), role: 'destructive', data: 'delete', icon: ICONS.delete },
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
