import { spawn } from 'child_process'
import { platform, version as osVer } from 'os'
import https from 'https'
import { getPathEnv } from './path-utils'
import { checkWslState, getWslVersion, getDistroVersion } from './wsl'
import { DEPENDENCIES } from './dependencies'
import type { EnvCheckResult, WslState } from '@shared/types'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function runCommand(cmd: string, args: string[], timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: platform() === 'win32' ? process.env : getPathEnv()
    })
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')) }, timeout)
    let stdout = '', stderr = ''
    child.stdout.on('data', (d: Buffer) => stdout += d.toString())
    child.stderr.on('data', (d: Buffer) => stderr += d.toString())
    child.on('close', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `exit ${code}`))
    })
    child.on('error', reject)
  })
}

function parseVersion(raw: string): string | null {
  // 匹配完整版本号，包括 pre-release 后缀如 2026.7.1-2
  const m = raw.match(/v?(\d+\.\d+\.\d+(?:[-.]\w+(?:\.\w+)*)?)/)
  return m ? m[1] : null
}

function semverGte(v: string, min: string): boolean {
  const [a1, a2, a3] = v.split('.').map(Number)
  const [b1, b2, b3] = min.split('.').map(Number)
  if (a1 !== b1) return a1 > b1
  if (a2 !== b2) return a2 > b2
  return a3 >= b3
}

function fetchLatestNpm(pkg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://registry.npmjs.org/${pkg}/latest`, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return }
      let data = ''
      res.on('data', (c: string) => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data).version) } catch { reject(new Error('parse error')) }
      })
    })
    req.on('error', reject)
  })
}

// ──────────────────────────────────────────────
// Node + OpenClaw detection
// ──────────────────────────────────────────────
interface NodeOcInfo {
  nodeInstalled: boolean
  nodeVersion: string | null
  nodeVersionOk: boolean
  openclawInstalled: boolean
  openclawVersion: string | null
}

async function checkNodeAndOpenclaw(
  run: (cmd: string, args: string[]) => Promise<string>
): Promise<NodeOcInfo> {
  const info: NodeOcInfo = {
    nodeInstalled: false, nodeVersion: null, nodeVersionOk: false,
    openclawInstalled: false, openclawVersion: null
  }

  // Node.js
  try {
    const raw = await run('node', ['--version'])
    const ver = parseVersion(raw)
    if (ver) {
      info.nodeInstalled = true
      info.nodeVersion = ver
      info.nodeVersionOk = semverGte(ver, DEPENDENCIES.nodejs.minVersion)
    }
  } catch { /* not installed */ }

  // OpenClaw binary check (source of truth)
  try {
    const raw = await run('openclaw', ['--version'])
    const ver = parseVersion(raw)
    if (ver) {
      info.openclawInstalled = true
      info.openclawVersion = ver
    }
  } catch {
    // Fallback: npm list
    try {
      const raw = await run('npm', ['list', '-g', 'openclaw', '--json'])
      const json = JSON.parse(raw)
      const ver = json?.dependencies?.openclaw?.version as string | undefined
      if (ver) info.openclawVersion = ver
    } catch { /* not installed */ }
  }

  return info
}

// ──────────────────────────────────────────────
// OpenClaw Update Check
// ──────────────────────────────────────────────
export async function checkOpenclawUpdate(): Promise<{ currentVersion: string | null; latestVersion: string | null }> {
  let currentVersion: string | null = null
  let latestVersion: string | null = null

  try {
    const isWin = platform() === 'win32'
    if (isWin) {
      const raw = await runCommand('wsl', [
        '-d', 'Ubuntu', '-u', 'root', '--', 'bash', '-lc',
        'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null; npm list -g openclaw --json'
      ])
      const json = JSON.parse(raw)
      currentVersion = json?.dependencies?.openclaw?.version ?? null
    } else {
      const raw = await runCommand('npm', ['list', '-g', 'openclaw', '--json'])
      const json = JSON.parse(raw)
      currentVersion = json?.dependencies?.openclaw?.version ?? null
    }
  } catch { /* not installed */ }

  try { latestVersion = await fetchLatestNpm('openclaw') } catch { /* network issue */ }

  return { currentVersion, latestVersion }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────
export async function checkEnvironment(): Promise<EnvCheckResult> {
  const os = platform() === 'darwin' ? 'macos' : platform() === 'win32' ? 'windows' : 'linux'

  // Get user-friendly OS version string
  let osVersion: string | undefined
  try {
    if (os === 'windows') {
      const raw = osVer()
      const m = raw.match(/Windows (\d+\.?\d*)/)
      osVersion = m ? `Windows ${m[1]}` : raw
    } else if (os === 'macos') {
      const raw = osVer()
      osVersion = raw
    } else {
      osVersion = osVer()
    }
  } catch { /* ignore */ }

  let wslState: WslState | undefined
  let nodeInstalled = false, nodeVersion: string | null = null, nodeVersionOk = false
  let openclawInstalled = false, openclawVersion: string | null = null

  let wslVersion: string | undefined
  let distroVersion: string | undefined

  if (os === 'windows') {
    wslState = await checkWslState()

    if (wslState === 'ready') {
      wslVersion = await getWslVersion() ?? undefined
      distroVersion = await getDistroVersion() ?? undefined

      const wslRun = (cmd: string, args: string[]): Promise<string> =>
        runCommand('wsl', [
          '-d', 'Ubuntu', '-u', 'root', '--', 'bash', '-lc',
          `export NVM_DIR="\${NVM_DIR:-\$HOME/.nvm}"; [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh" 2>/dev/null; ${cmd} ${args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`
        ])
      const info = await checkNodeAndOpenclaw(wslRun)
      nodeInstalled = info.nodeInstalled
      nodeVersion = info.nodeVersion
      nodeVersionOk = info.nodeVersionOk
      openclawInstalled = info.openclawInstalled
      openclawVersion = info.openclawVersion
    } else {
      openclawInstalled = false
      openclawVersion = null
    }
  } else {
    const info = await checkNodeAndOpenclaw(runCommand)
    nodeInstalled = info.nodeInstalled; nodeVersion = info.nodeVersion
    nodeVersionOk = info.nodeVersionOk; openclawInstalled = info.openclawInstalled
    openclawVersion = info.openclawVersion
  }

  let openclawLatestVersion: string | null = null
  try { openclawLatestVersion = await fetchLatestNpm('openclaw') } catch { /* network error */ }

  return {
    os, osVersion, nodeInstalled, nodeVersion, nodeVersionOk,
    openclawInstalled, openclawVersion, openclawLatestVersion,
    ...(os === 'windows' ? { wslState, wslVersion, distroVersion } : {})
  }
}
