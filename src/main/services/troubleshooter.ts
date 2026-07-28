import { spawn } from 'child_process'
import { platform } from 'os'
import { getPathEnv, findBin } from './path-utils'

/**
 * Check if port 18789 is in use.
 * Returns the PID of the owning process if found.
 */
export async function checkPort(): Promise<{ inUse: boolean; pid?: string }> {
  try {
    if (platform() === 'win32') {
      const netstatOut = await new Promise<string>((resolve, reject) => {
        const child = spawn('netstat', ['-ano'])
        let buf = ''
        child.stdout.on('data', (d: Buffer) => buf += d.toString())
        child.on('close', (code) => code === 0 ? resolve(buf) : reject(new Error(`exit ${code}`)))
        child.on('error', reject)
      })
      const lines = netstatOut.split('\n').filter((l: string) => l.includes(':18789') && l.includes('LISTENING'))
      if (lines.length > 0) {
        const parts = lines[0].trim().split(/\s+/)
        return { inUse: true, pid: parts[parts.length - 1] }
      }
      return { inUse: false }
    } else {
      const out = await new Promise<string>((resolve, reject) => {
        const child = spawn('lsof', ['-i', ':18789', '-t'])
        let data = ''
        child.stdout.on('data', (d: Buffer) => data += d.toString())
        child.on('close', (code) => code === 0 ? resolve(data.trim()) : resolve(''))
        child.on('error', reject)
      })
      if (out) return { inUse: true, pid: out.split('\n')[0].trim() }
      return { inUse: false }
    }
  } catch {
    return { inUse: false }
  }
}

/**
 * Run `openclaw doctor --fix` to auto-resolve common issues.
 */
export async function runDoctorFix(): Promise<{ success: boolean }> {
  try {
    const isWin = platform() === 'win32'
    if (isWin) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn('wsl', [
          '-d', 'Ubuntu', '-u', 'root', '--', 'bash', '-lc',
          'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null; openclaw doctor --fix'
        ])
        child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)))
        child.on('error', reject)
      })
    } else {
      await new Promise<void>((resolve, reject) => {
        const oc = findBin('openclaw')
        const child = spawn(oc, ['doctor', '--fix'], { env: getPathEnv() })
        child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)))
        child.on('error', reject)
      })
    }
    return { success: true }
  } catch {
    return { success: false }
  }
}
