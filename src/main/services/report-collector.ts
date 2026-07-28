import { app } from 'electron'
import { platform, homedir } from 'os'
import { getSupervisor } from './gateway-supervisor'
import { checkPort } from './troubleshooter'

/**
 * Collect system report information, masking PII (API keys, tokens).
 */
export async function collectReport(): Promise<{ timestamp: number; text: string }> {
  const ts = Date.now()
  const lines: string[] = []

  lines.push(`=== JustClaw Report ===`)
  lines.push(`Timestamp: ${new Date(ts).toISOString()}`)
  lines.push(`App Version: ${app.getVersion()}`)
  lines.push(`OS: ${platform()}`)
  lines.push(`Electron: ${process.versions.electron}`)
  lines.push(`Node: ${process.versions.node}`)
  lines.push(`Home: ${homedir()}`)

  // Gateway status
  const supervisor = getSupervisor()
  lines.push(`\n--- Gateway ---`)
  lines.push(`Status: ${supervisor.getStatus()}`)

  const exitInfo = supervisor.lastExitInfo()
  if (exitInfo) {
    lines.push(`Last Exit: code=${exitInfo.code}, ts=${new Date(exitInfo.ts).toISOString()}`)
    if (exitInfo.stderrTail) lines.push(`Last Stderr (tail):\n${exitInfo.stderrTail.slice(0, 2000)}`)
  }

  // Port check
  const port = await checkPort()
  lines.push(`Port 18789: ${port.inUse ? `in use (PID ${port.pid})` : 'free'}`)

  // Platform specifics
  if (platform() === 'darwin') {
    try {
      const { execSync } = require('child_process')
      const launchd = execSync('launchctl list | grep openclaw 2>/dev/null || true', { timeout: 3000 }).toString().trim()
      lines.push(`launchctl: ${launchd || 'not found'}`)
    } catch { lines.push('launchctl: check failed') }
  } else if (platform() === 'win32') {
    try {
      const { execSync } = require('child_process')
      const wsl = execSync('wsl --list --verbose 2>/dev/null || true', { timeout: 3000 }).toString().trim()
      lines.push(`WSL: ${wsl || 'not available'}`)
    } catch { lines.push('WSL: check failed') }
  }

  // Mask PII: tokens, API keys
  let text = lines.join('\n')
  text = text.replace(/\d{7,10}:[A-Za-z0-9_-]{30,}/g, '****MASKED****')
  text = text.replace(/sk-ant-[A-Za-z0-9]{40,}/g, '****MASKED****')
  text = text.replace(/sk-[A-Za-z0-9]{20,}/g, '****MASKED****')
  text = text.replace(/AIza[A-Za-z0-9_-]{35,}/g, '****MASKED****')

  return { timestamp: ts, text }
}
