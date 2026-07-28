import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { createTray, destroyTray } from './services/tray'
import { stopAutoUpdate } from './services/openclaw-updater'
import { logger } from './services/logger'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

const getWin = (): BrowserWindow | null => mainWindow

function createWindow(): void {
  const startHidden =
    app.getLoginItemSettings().wasOpenedAsHidden || process.argv.includes('--hidden')

  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 700,
    minHeight: 500,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (mainWindow && !startHidden) mainWindow.show()
  })

  // Close = quit app (no tray background)
  mainWindow.on('close', () => {
    if (!isQuitting) {
      isQuitting = true
      stopAutoUpdate()
      app.quit()
    }
  })

  // External links open in browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (['https:', 'tg:'].includes(url.protocol)) {
        shell.openExternal(details.url)
      }
    } catch {
      /* invalid URL */
    }
    return { action: 'deny' }
  })

  registerIpcHandlers(getWin)

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // System tray (for minimize-to-tray via menu)
  createTray(getWin, () => {
    isQuitting = true
    app.quit()
  })

  // 不再自动更新，由用户手动触发

  if (startHidden) {
    mainWindow.hide()
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  isQuitting = true
  stopAutoUpdate()
})

app.on('quit', () => {
  destroyTray()
  logger.close()
})
