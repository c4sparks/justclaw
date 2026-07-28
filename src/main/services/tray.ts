import { Menu, Tray, nativeImage, BrowserWindow, Notification } from 'electron'
import { getSupervisor } from './gateway-supervisor'

/**
 * System tray manager — keeps the app alive in the background.
 * Polls gateway status every 10s and shows desktop notifications on state changes.
 */

let tray: Tray | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null
let lastNotifiedStatus = ''

/** 16x16 orange circle PNG (base64) */
const TRAY_ICON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAArklEQVQ4T6WTOw7CQAxE5ydRqOi4' +
  'AS0VN0Ci4gI0dFyAgoYbUFFRcQEaKj4SJUI0icNOlNVuYkmRLCt+47EdW4QI/3YIXQM6wJIN3QEJ' +
  '4GUMmAG2oHcKgyXhHrAHHMCdmJqYqjEDb3QHfbsA3kQ9VNcBJoCGmA44gMYqYH6hH+g1ATe+I6Ni' +
  'K2APuIPeRiVwN4SvgDVog5N4BmzYEb4DXoA/xQdxB+yA6A80sik+E+DDQQAAAABJRU5ErkJggg=='

export function createTray(getWin: () => BrowserWindow | null, onQuit: () => void): void {
  if (tray) return

  const icon = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON_PNG_BASE64, 'base64'))
  tray = new Tray(icon)
  tray.setToolTip('JustClaw — OpenClaw AI Agent Manager')

  function buildMenu(): void {
    const sup = getSupervisor()
    const status = sup.getStatus()
    const win = getWin()
    const isVisible = win && !win.isDestroyed() && win.isVisible()

    tray?.setToolTip(`JustClaw — Gateway: ${status}`)

    const menu = Menu.buildFromTemplate([
      { label: `Gateway: ${status}`, enabled: false },
      { type: 'separator' },
      {
        label: isVisible ? 'Hide Window' : 'Show Window',
        click: () => {
          const w = getWin()
          if (!w || w.isDestroyed()) return
          isVisible ? w.hide() : (w.show(), w.focus())
        }
      },
      { type: 'separator' },
      { label: 'Quit', click: () => onQuit() }
    ])
    tray?.setContextMenu(menu)
  }

  buildMenu()

  const win = getWin()
  if (win && !win.isDestroyed()) {
    win.on('show', buildMenu)
    win.on('hide', buildMenu)
  }

  // Poll gateway status every 10s
  const supervisor = getSupervisor()
  supervisor.on('status-changed', (s: string) => {
    buildMenu()
    // Debounce notifications (5 min cooldown)
    if (s !== lastNotifiedStatus) {
      lastNotifiedStatus = s
      if (s === 'gave_up' || s === 'failed') {
        try {
          if (Notification.isSupported()) {
            new Notification({ title: 'JustClaw', body: `Gateway status: ${s}` }).show()
          }
        } catch { /* ignore */ }
      }
    }
  })

  // Also poll periodically
  pollInterval = setInterval(() => {
    buildMenu()
  }, 10000)
}

export function destroyTray(): void {
  if (pollInterval) clearInterval(pollInterval)
  if (tray) { tray.destroy(); tray = null }
}
