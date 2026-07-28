/**
 * Background OpenClaw npm package auto-updater.
 * Polls npm registry periodically, downloads updates when available.
 * Emits IPC events to the renderer for progress UI.
 */

import { platform } from 'os'
import { spawn } from 'child_process'
import { BrowserWindow, Notification } from 'electron'
import { checkOpenclawUpdate } from './env-checker'
import { getPathEnv } from './path-utils'
import { logger } from './logger'

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const INITIAL_DELAY = 30_000     // 30s after app start
const POLL_INTERVAL = 6 * 60 * 60 * 1000  // Every 6 hours
const isWin = platform() === 'win32'

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
let started = false
let inProgress = false
let timer: ReturnType<typeof setTimeout> | null = null
let latestVersion: string | null = null

// ──────────────────────────────────────────────
// Event emitter helper
// ──────────────────────────────────────────────
function emit(getWin: () => BrowserWindow | null, channel: string, payload?: any): void {
  try {
    const win = getWin()
    if (win && !win.isDestroyed()) {
      win.webContents.send(`openclaw:auto-update-${channel}`, payload ?? {})
    }
  } catch { /* ignore */ }
}

// ──────────────────────────────────────────────
// Run update check + install
// ──────────────────────────────────────────────
async function runCheck(getWin: () => BrowserWindow | null): Promise<void> {
  if (inProgress) return
  inProgress = true

  try {
    const info = await checkOpenclawUpdate()
    if (!info.currentVersion || !info.latestVersion) return
    if (info.currentVersion === info.latestVersion) {
      latestVersion = null
      return
    }

    latestVersion = info.latestVersion
    logger.info('oc-updater', `Update available: ${info.currentVersion} → ${info.latestVersion}`)
    emit(getWin, 'started', { from: info.currentVersion, to: info.latestVersion })

    // Stop gateway if running
    const { getSupervisor } = await import('./gateway-supervisor')
    const sup = getSupervisor()
    const wasRunning = sup.getStatus() === 'running'
    if (wasRunning) {
      emit(getWin, 'progress', { msg: 'Stopping Gateway...' })
      await sup.stop().catch(() => {})
    }

    // Run npm install
    emit(getWin, 'progress', { msg: 'Updating OpenClaw...' })
    await npmUpdate()

    // Restart gateway if it was running
    if (wasRunning) {
      emit(getWin, 'progress', { msg: 'Restarting Gateway...' })
      const result = await sup.start()
      if (result.status !== 'started') {
        emit(getWin, 'error', { error: result.error ?? 'Gateway failed to restart' })
        return
      }
    }

    emit(getWin, 'done', { from: info.currentVersion, to: info.latestVersion })
    logger.info('oc-updater', `Updated to ${info.latestVersion}`)

    // Show notification
    try {
      if (Notification.isSupported()) {
        new Notification({ title: 'JustClaw', body: `OpenClaw updated to ${info.latestVersion}` }).show()
      }
    } catch { /* ignore */ }
  } catch (err) {
    logger.error('oc-updater', 'Auto-update failed', { error: String(err) })
    emit(getWin, 'error', { error: String(err) })
  } finally {
    inProgress = false
  }
}

function npmUpdate(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isWin) {
      const child = spawn('wsl', [
        '-d', 'Ubuntu', '-u', 'root', '--', 'bash', '-lc',
        'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null; npm install -g openclaw@latest'
      ])
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)))
      child.on('error', reject)
    } else {
      const child = spawn('npm', ['install', '-g', 'openclaw@latest'], { env: getPathEnv() })
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)))
      child.on('error', reject)
    }
  })
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────
export function isUpdating(): boolean { return inProgress }

export function startAutoUpdate(getWin: () => BrowserWindow | null): void {
  if (started) return
  started = true

  const schedule = (): void => {
    timer = setTimeout(async () => {
      await runCheck(getWin)
      schedule()
    }, POLL_INTERVAL)
  }

  // First check after initial delay
  timer = setTimeout(async () => {
    await runCheck(getWin)
    schedule()
  }, INITIAL_DELAY)
}

export function stopAutoUpdate(): void {
  if (timer) { clearTimeout(timer); timer = null }
  started = false
}

export function triggerUpdateNow(getWin: () => BrowserWindow | null): Promise<void> {
  return runCheck(getWin)
}
