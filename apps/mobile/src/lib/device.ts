import { Device } from '@capacitor/device'

/** "Pixel 8 · Android 16": how this phone shows up in Settings › Devices. */
export async function deviceLabel(): Promise<string> {
  try {
    const info = await Device.getInfo()
    const os =
      info.operatingSystem === 'ios'
        ? 'iOS'
        : info.operatingSystem === 'android'
          ? 'Android'
          : info.operatingSystem
    return `${info.model} · ${os} ${info.osVersion}`.trim().slice(0, 100)
  } catch {
    return 'Phone'
  }
}
