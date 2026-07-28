import { spawn } from 'child_process'
import type { WslState } from '@shared/types'
import { WSL } from '../config'

/**
 * WSL utility service — detect state, run commands, read/write files.
 * Uses a non-privileged 'openclaw' user for all operations,
 * elevating to root only for system-level installs.
 *
 * 用户路径说明（见 config.ts）:
 *   - WSL.user = 'openclaw'  →  Gateway 运行用户（最小权限）
 *   - WSL.rootUser = 'root'  →  系统操作用户
 *   - WSL.configPath         →  /home/openclaw/.openclaw/openclaw.json
 */

const DISTRO = WSL.distro
const USER = WSL.user
const ROOT_USER = WSL.rootUser
export const WSL_CONFIG_DIR = WSL.configDir
export const WSL_OC_PATH = WSL.configPath

/**
 * Ensure the 'openclaw' user exists in WSL.
 * Idempotent — safe to call multiple times.
 */
export async function ensureUser(): Promise<void> {
  try {
    await run(RUN_MODE.SYSTEM, 'id', ['-u', USER])
  } catch {
    // User doesn't exist — create it
    await run(RUN_MODE.SYSTEM, 'useradd', ['-m', '-s', '/bin/bash', USER], 15000)
    // Ensure nvm directory exists for the new user
    await cmd(ROOT_USER, `mkdir -p /home/${USER}/.nvm && chown -R ${USER}:${USER} /home/${USER}/.nvm`)
  }
}

enum RUN_MODE { USER = 0, SYSTEM = 1 }

function run(mode: RUN_MODE, cmd: string, args: string[], timeout = 15000): Promise<string> {
  const user = mode === RUN_MODE.SYSTEM ? ROOT_USER : USER
  return new Promise((resolve, reject) => {
    const child = spawn('wsl', ['-d', DISTRO, '-u', user, '--', cmd, ...args])
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')) }, timeout)
    let stdout = '', stderr = ''
    child.stdout.on('data', (d: Buffer) => stdout += d.toString())
    child.stderr.on('data', (d: Buffer) => stderr += d.toString())
    child.on('close', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve(stdout.replace(/\0/g, '').trim()) : reject(new Error(stderr.replace(/\0/g, '').trim() || `exit ${code}`))
    })
    child.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Run a global WSL command (no distro context), e.g. wsl --version, wsl --status.
 */
function runWslGlobal(args: string[], timeout = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('wsl', args)
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')) }, timeout)
    let stdout = '', stderr = ''
    child.stdout.on('data', (d: Buffer) => stdout += d.toString())
    child.stderr.on('data', (d: Buffer) => stderr += d.toString())
    child.on('close', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve(stdout.replace(/\0/g, '').trim()) : reject(new Error(stderr.replace(/\0/g, '').trim() || `exit ${code}`))
    })
    child.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
}

/**
 * Check WSL installation state.
 */
export async function checkWslState(): Promise<WslState> {
  // ① WSL 命令是否可用（不启动发行版）
  try { await runWslGlobal(['--version']) } catch {
    try { await runWslGlobal(['--version']) } catch {
      try { await runWslGlobal(['--help']) } catch { return 'not_available' }
    }
  }
  // ② 检查是否需要重启
  try {
    const status = await runWslGlobal(['--status'])
    if (/reboot|restart|재부팅/i.test(status)) return 'needs_reboot'
  } catch { /* proceed */ }
  // ③ 检查 Ubuntu 发行版是否已安装
  try {
    const list = await runWslGlobal(['--list', '--verbose'])
    if (!list.includes('Ubuntu')) return 'no_distro'
    // ④ 验证发行版能否正常启动（使用 root，触发首次初始化）
    try { await run(RUN_MODE.SYSTEM, 'echo', ['ok'], 60000); return 'ready' }
    catch { return 'not_initialized' }
  } catch { return 'not_installed' }
}

/**
 * Get WSL version string (e.g. "2.4.13").
 */
export async function getWslVersion(): Promise<string | null> {
  try {
    const raw = await runWslGlobal(['--version'])
    const m = raw.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/)
    return m ? m[1] : null
  } catch { return null }
}

/**
 * Get Ubuntu distro version inside WSL (e.g. "24.04").
 */
export async function getDistroVersion(): Promise<string | null> {
  try {
    const raw = await runInWslAsRoot('lsb_release -rs 2>/dev/null || cat /etc/os-release 2>/dev/null | grep VERSION_ID | cut -d= -f2 | tr -d \'"\' || echo ""', 10000)
    return raw.trim() || null
  } catch { return null }
}

/**
 * Run a shell command inside WSL as non-root user.
 */
export function runInWsl(script: string, timeout = 30000): Promise<string> {
  return cmd(USER, script, timeout)
}

/**
 * Run a shell command inside WSL as root (for system operations only).
 */
export function runInWslAsRoot(script: string, timeout = 30000): Promise<string> {
  return cmd(ROOT_USER, script, timeout)
}

function cmd(user: string, script: string, timeout = 30000): Promise<string> {
  const nvmInit = 'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null; '
  return new Promise((resolve, reject) => {
    const child = spawn('wsl', ['-d', DISTRO, '-u', user, '--', 'bash', '-lc', nvmInit + script])
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')) }, timeout)
    let stdout = '', stderr = ''
    child.stdout.on('data', (d: Buffer) => stdout += d.toString())
    child.stderr.on('data', (d: Buffer) => stderr += d.toString())
    child.on('close', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve(stdout.replace(/\0/g, '').trim()) : reject(new Error(stderr.replace(/\0/g, '').trim() || `exit ${code}`))
    })
    child.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
}

/**
 * Read a file inside WSL.
 */
export function readWslFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('wsl', ['-d', DISTRO, '-u', USER, '--', 'cat', path])
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Timeout reading ${path}`)) }, 10000)
    let stdout = ''
    child.stdout.on('data', (d: Buffer) => stdout += d.toString())
    child.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(new Error(`Failed to read ${path}`)) })
    child.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
}

/**
 * Write a file inside WSL as root.
 */
export function writeWslFileAsRoot(path: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('wsl', ['-d', DISTRO, '-u', ROOT_USER, '--', 'tee', path])
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Timeout writing ${path}`)) }, 10000)
    child.stdout.resume()
    child.stdin.write(content, () => child.stdin.end())
    child.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Failed to write ${path}`)) })
    child.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
}

/**
 * Write a file inside WSL.
 */
export function writeWslFile(path: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('wsl', ['-d', DISTRO, '-u', USER, '--', 'tee', path])
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Timeout writing ${path}`)) }, 10000)
    child.stdout.resume()
    child.stdin.write(content, () => child.stdin.end())
    child.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Failed to write ${path}`)) })
    child.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
}
