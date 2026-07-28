import { spawn } from 'child_process'
import { platform, homedir } from 'os'
import { dialog, type BrowserWindow } from 'electron'
import { join } from 'path'
import { getPathEnv } from './path-utils'
import { WSL } from '../config'
import { WSL_CONFIG_DIR, runInWsl, runInWslAsRoot } from './wsl'

// ──────────────────────────────────────────────
// Backup OpenClaw config (tar archive)
// ──────────────────────────────────────────────
export async function exportBackup(win: BrowserWindow): Promise<{ success: boolean; error?: string }> {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save OpenClaw Backup',
      defaultPath: `openclaw-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`,
      filters: [{ name: 'Archive', extensions: ['tar.gz'] }]
    })
    if (canceled || !filePath) return { success: false, error: 'CANCELLED' }

    const isWin = platform() === 'win32'
    if (isWin) {
      // Use non-root wsl service for backup
      await new Promise<void>((resolve, reject) => {
        const out = spawn('wsl', ['-d', WSL.distro, '-u', WSL.user, '--', 'tar', '-czf', '-', '-C', WSL_CONFIG_DIR, '.'])
        const write = spawn('powershell', ['-NoProfile', '-Command',
          `[IO.File]::WriteAllBytes('${filePath.replace(/'/g, "''")}', $input)`])
        out.stdout.pipe(write.stdin)
        out.stderr.on('data', (d: Buffer) => process.stderr.write(d))
        write.on('close', (code) => code === 0 ? resolve() : reject(new Error(`write exit ${code}`)))
        out.on('close', (code) => { if (code !== 0) reject(new Error(`tar exit ${code}`)) })
        out.on('error', reject)
      })
    } else {
      const home = homedir()
      await new Promise<void>((resolve, reject) => {
        const child = spawn('tar', ['-czf', filePath, '-C', join(home, '.openclaw'), '.'], { env: getPathEnv() })
        child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`tar exit ${code}`)))
        child.on('error', reject)
      })
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ──────────────────────────────────────────────
// Restore OpenClaw config from tar archive
// ──────────────────────────────────────────────
export async function importBackup(win: BrowserWindow): Promise<{ success: boolean; error?: string }> {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select Backup File',
      filters: [{ name: 'Archive', extensions: ['tar.gz'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return { success: false, error: 'CANCELLED' }

    const filePath = filePaths[0]
    const isWin = platform() === 'win32'

    if (isWin) {
      // Ensure config directory exists as non-root
      await runInWsl(`mkdir -p ${WSL_CONFIG_DIR}`, 10000)
      await new Promise<void>((resolve, reject) => {
        const read = spawn('powershell', ['-NoProfile', '-Command',
          `[IO.File]::ReadAllBytes('${filePath.replace(/'/g, "''")}')`])
        const untar = spawn('wsl', ['-d', WSL.distro, '-u', WSL.user, '--', 'bash', '-c',
          `mkdir -p ${WSL_CONFIG_DIR} && tar -xzf - -C ${WSL_CONFIG_DIR}`])
        read.stdout.pipe(untar.stdin)
        untar.on('close', (code) => code === 0 ? resolve() : reject(new Error(`untar exit ${code}`)))
        read.on('close', (code) => { if (code !== 0) reject(new Error(`read exit ${code}`)) })
        read.on('error', reject)
      })
    } else {
      const home = homedir()
      await new Promise<void>((resolve, reject) => {
        const child = spawn('tar', ['-xzf', filePath, '-C', join(home, '.openclaw')], { env: getPathEnv() })
        child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`tar exit ${code}`)))
        child.on('error', reject)
      })
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
