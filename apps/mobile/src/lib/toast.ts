import { toastController } from '@ionic/vue'
import { t } from './i18n'

/** A short message at the bottom, with an optional Undo. */
export async function toast(
  message: string,
  opts: { undo?: () => void; error?: boolean; duration?: number } = {},
) {
  await toastController.dismiss().catch(() => undefined)
  const el = await toastController.create({
    message,
    duration: opts.duration ?? (opts.undo ? 6000 : 2500),
    position: 'bottom',
    positionAnchor: 'omb-tab-bar',
    cssClass: opts.error ? 'omb-toast omb-toast-error' : 'omb-toast',
    buttons: opts.undo ? [{ text: t('actions.undo'), role: 'cancel', handler: opts.undo }] : [],
  })
  await el.present()
}

export const saveFailed = () => toast(t('toasts.saveFailed'), { error: true })
