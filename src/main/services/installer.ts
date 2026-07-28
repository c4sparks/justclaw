import { spawn } from 'child_process'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { readdir, rm } from 'fs/promises'
import { tmpdir, homedir, platform } from 'os'
import { join } from 'path'
import https from 'https'
import { getPathEnv } from './path-utils'
import { WSL_USER } from '../config'
import type { BrowserWindow } from 'electron'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type ProgressFn = (msg: string) => void

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function spawnCmd(
  cmd: string, args: string[],
  onLog: ProgressFn,
  options?: { env?: NodeJS.ProcessEnv; timeout?: number }
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: options?.env ?? process.env })
    const lines: string[] = []
    const timer = options?.timeout ? setTimeout(() => { child.kill(); reject(new Error('timeout')) }, options.timeout) : null

    const handler = (d: Buffer) => {
      d.toString().split('\n').filter(Boolean).forEach((l) => { onLog(l); lines.push(l) })
    }
    child.stdout.on('data', handler)
    child.stderr.on('data', handler)
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      code === 0 ? resolve(lines) : reject(new Error(`Exit ${code}: ${lines.slice(-3).join('; ')}`))
    })
    child.on('error', (err) => { if (timer) clearTimeout(timer); reject(err) })
  })
}

function downloadFile(url: string, dest: string, maxRedir = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    let count = 0
    const follow = (u: string) => {
      https.get(u, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          if (++count > maxRedir) { reject(new Error('Too many redirects')); return }
          follow(res.headers.location); return
        }
        if (!res.statusCode || res.statusCode >= 400) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return }
        const file = createWriteStream(dest)
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
        file.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

// ──────────────────────────────────────────────
// macOS Node.js installer (opens .pkg)
// ──────────────────────────────────────────────
export async function installNodeMac(onLog: ProgressFn, mirror?: string): Promise<void> {
  const { DEPENDENCIES } = await import('./dependencies')
  const base = mirror || DEPENDENCIES.nodejs.mirrors.OFFICIAL
  const url = DEPENDENCIES.nodejs.macUrl(base, DEPENDENCIES.nodejs.minVersion)
  const dest = join(tmpdir(), 'node-installer.pkg')
  onLog('Downloading Node.js installer...')
  await downloadFile(url, dest)
  onLog('Opening installer...')
  await spawnCmd('open', ['-W', dest], onLog)
  onLog('Node.js installation done')
}

// ──────────────────────────────────────────────
// macOS OpenClaw installer (npm -g)
// ──────────────────────────────────────────────
export async function installOpenClawMac(onLog: ProgressFn, registry?: string): Promise<void> {
  const npmGlobalDir = join(homedir(), '.npm-global')
  if (!existsSync(npmGlobalDir)) mkdirSync(npmGlobalDir, { recursive: true })
  await spawnCmd('npm', ['config', 'set', 'prefix', npmGlobalDir], onLog, { env: getPathEnv() })

  const env = getPathEnv()
  const npmArgs = ['install', '-g', 'openclaw@latest']
  if (registry) npmArgs.push('--registry', registry)
  const doInstall = (): Promise<string[]> =>
    spawnCmd('npm', npmArgs, onLog, { env, timeout: 300000 })

  try {
    await doInstall()
  } catch (firstErr) {
    onLog(`npm install failed: ${firstErr instanceof Error ? firstErr.message : String(firstErr)}`)
    onLog('Cleaning up and retrying...')
    const modulesDir = join(npmGlobalDir, 'lib', 'node_modules')
    const entries = await readdir(modulesDir).catch(() => [] as string[])
    await Promise.all(
      entries
        .filter((n) => n === 'openclaw' || n.startsWith('openclaw-') || n.startsWith('.openclaw-'))
        .map((n) => rm(join(modulesDir, n), { recursive: true, force: true }).catch(() => {}))
    )
    await spawnCmd('npm', ['cache', 'clean', '--force'], onLog, { env }).catch(() => {})
    await doInstall()
  }
}

// ──────────────────────────────────────────────
// Windows WSL installers
// ──────────────────────────────────────────────
const WSL_NVM = 'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null; '

function wslExec(script: string, timeout = 60000): Promise<string[]> {
  // Use clean Linux PATH to avoid picking up Windows npm from WSL's appended Windows PATH
  const cleanPath = 'export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"; '
  return new Promise((resolve, reject) => {
    const child = spawn('wsl', ['-d', 'Ubuntu', '-u', 'root', '--', 'bash', '-lc', cleanPath + WSL_NVM + script])
    const lines: string[] = []
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')) }, timeout)
    child.stdout.on('data', (d: Buffer) => { d.toString().split('\n').filter(Boolean).forEach((l) => lines.push(l)) })
    child.stderr.on('data', (d: Buffer) => { d.toString().split('\n').filter(Boolean).forEach((l) => lines.push(l)) })
    child.on('close', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve(lines) : reject(new Error(`Exit ${code}: ${lines.slice(-5).join('; ')}`))
    })
    child.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
}

export async function installNodeWsl(onLog: ProgressFn): Promise<void> {
  const { DEPENDENCIES } = await import('./dependencies')
  onLog('Updating WSL packages...')
  try { await wslExec('apt-get update && apt-get install -y curl ca-certificates gnupg', 120000) }
  catch { onLog('apt-get failed (non-fatal)') }
  onLog('Installing Node.js in WSL...')
  await wslExec(DEPENDENCIES.nodejs.wslSetup(DEPENDENCIES.nodejs.minVersion), 180000)
  onLog('Node.js installed in WSL')
}

export async function installOpenClawWsl(onLog: ProgressFn, registry?: string): Promise<void> {
  const npmCmd = 'npm install -g openclaw@latest' + (registry ? ` --registry ${registry}` : '')
  onLog('Installing OpenClaw in WSL...')
  try {
    await wslExec(npmCmd, 300000)
  } catch (firstErr) {
    onLog(`npm install failed: ${firstErr instanceof Error ? firstErr.message : String(firstErr)}`)
    onLog('Cleaning up and retrying...')
    await wslExec(
      'ROOT="$(npm root -g 2>/dev/null)"; ' +
      'rm -rf /usr/lib/node_modules/openclaw /usr/lib/node_modules/.openclaw-*; ' +
      'if [ -n "$ROOT" ]; then rm -rf "$ROOT/openclaw" "$ROOT"/openclaw-* "$ROOT"/.openclaw-*; fi; ' +
      'npm cache clean --force >/dev/null 2>&1 || true',
      60000
    ).catch(() => {})
    await wslExec(npmCmd, 300000)
  }
  // Create non-privileged 'openclaw' user for runtime operations
  onLog('Setting up OpenClaw user...')
  try {
    await wslExec(`id -u ${WSL_USER} 2>/dev/null || (useradd -m -s /bin/bash ${WSL_USER} && mkdir -p /home/${WSL_USER}/.nvm && chown -R ${WSL_USER}:${WSL_USER} /home/${WSL_USER})`, 15000)
  } catch { onLog('User setup skipped (non-fatal)') }
  onLog('OpenClaw installed in WSL')
}

// ──────────────────────────────────────────────
// Main install entry points (with IPC progress)
// ──────────────────────────────────────────────
function ts(msg: string): string {
  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  return `${date} ${time} ${msg}`
}

export async function installNode(win: BrowserWindow, mirror?: string): Promise<void> {
  const log = (msg: string) => { try { win.webContents.send('install:progress', ts(msg)) } catch { /* ignore */ } }
  log('Starting Node.js installation...')
  if (platform() === 'win32') {
    await installNodeWsl(log)
  } else {
    await installNodeMac(log, mirror)
  }
  log('Node.js installation completed')
}

export async function installOpenClaw(win: BrowserWindow, registry?: string): Promise<void> {
  const log = (msg: string) => { try { win.webContents.send('install:progress', ts(msg)) } catch { /* ignore */ } }
  log(`Starting OpenClaw installation (registry: ${registry || 'default'})...`)
  if (platform() === 'win32') {
    await installOpenClawWsl(log, registry)
  } else {
    await installOpenClawMac(log, registry)
  }
  log('OpenClaw installation completed')
}
