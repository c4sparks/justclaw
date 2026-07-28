import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { platform } from 'os'
import { getPathEnv, findBin } from './path-utils'
import { probeAlive } from './gateway-probes'
import { recordRestart, countAutoInLastHour } from './restart-history'
import { WSL, GATEWAY, PATHS } from '../config'
import type { GatewayStatus } from '@shared/types'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
export interface ExitInfo {
  code: number | null
  stderrTail: string
  ts: number
}

export interface StartResult {
  status: 'started' | 'error'
  error?: string
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const HEALTH_INTERVAL = 5000
const BOOT_PROBE_INTERVAL = 500
const BOOT_PROBE_MAX = 15000
const STDERR_TAIL = 200
const BACKOFF = [0, 2000, 5000, 15000, 60000]
const MAX_RESTARTS_PER_HOUR = 5

const isWin = platform() === 'win32'
const WSL_NVM_INIT = PATHS.wslNvmInit

// ──────────────────────────────────────────────
// Supervisor class
// ──────────────────────────────────────────────
class GatewaySupervisor extends EventEmitter {
  private _status: GatewayStatus = 'idle'
  private child: ChildProcess | null = null
  private stderrBuf: string[] = []
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private lastExit: ExitInfo | null = null
  private starting: Promise<StartResult> | null = null
  private stopping: Promise<void> | null = null
  private gaveUp = false
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private suppressRestart = false
  private restartCount = 0

  getStatus(): GatewayStatus { return this._status }
  lastExitInfo(): ExitInfo | null { return this.lastExit }
  isGaveUp(): boolean { return this.gaveUp }

  async isAlive(): Promise<boolean> {
    return probeAlive()
  }

  async start(kind: 'manual' | 'auto' = 'manual'): Promise<StartResult> {
    if (kind === 'manual') {
      this.gaveUp = false
      this.cancelRestart()
    }
    if (this.starting) return this.starting
    this.starting = this._start(kind).finally(() => { this.starting = null })
    return this.starting
  }

  async stop(): Promise<void> {
    this.suppressRestart = true
    this.cancelRestart()
    if (this.stopping) return this.stopping
    this.stopping = this._stop().finally(() => { this.stopping = null; this.suppressRestart = false })
    return this.stopping
  }

  async restart(): Promise<StartResult> {
    try { await this.stop() } catch { /* ignore */ }
    await this.waitGone(5000)
    return this.start()
  }

  // ─── Internals ───

  private setStatus(s: GatewayStatus): void {
    if (this._status === s) return
    this._status = s
    this.emit('status-changed', s)
  }

  private log(...args: unknown[]): void {
    const msg = args.join(' ').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    if (msg) this.emit('log', msg)
  }

  private async _start(kind: 'manual' | 'auto'): Promise<StartResult> {
    if (this._status === 'running' && (await this.isAlive())) return { status: 'started' }

    this.setStatus(kind === 'auto' ? 'restarting' : 'starting')

    try {
      // 启动前先清理 crash loop breaker，避免缓存错误阻止启动
      if (isWin) {
        const { runInWsl } = await import('./wsl')
        await runInWsl('openclaw doctor --fix', 15000).catch(() => {})
      }
      const result = isWin ? await this.startWsl() : await this.startMac()
      recordRestart({ ts: Date.now(), kind, success: result.status === 'started', exitCode: this.lastExit?.code })
      if (result.status === 'started') {
        const alive = await this.waitAlive()
        if (!alive) {
          this.setStatus('failed')
          recordRestart({ ts: Date.now(), kind, success: false })
          return { status: 'error', error: 'boot probe timeout' }
        }
        this.setStatus('running')
        this.emit('started')
        if (kind === 'auto') this.emit('restarted')
        this.startHealthLoop()
      } else {
        this.setStatus('failed')
        this.emit('failed', result.error ?? 'unknown')
      }
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.setStatus('failed')
      this.emit('failed', msg)
      return { status: 'error', error: msg }
    }
  }

  private async _stop(): Promise<void> {
    this.stopHealthLoop()
    if (isWin) await this.stopWsl()
    else await this.stopMac()
    this.setStatus('idle')
  }

  private startHealthLoop(): void {
    if (this.healthTimer) return
    this.healthTimer = setInterval(() => {
      if (this.starting || this.stopping || this._status !== 'running') return
      this.isAlive().then((alive) => {
        if (alive) return
        this.setStatus('stopped')
        this.lastExit = { code: null, stderrTail: this.stderrBuf.slice(-STDERR_TAIL).join('\n'), ts: Date.now() }
        this.emit('died', this.lastExit)
        this.stopHealthLoop()
        this.scheduleRestart()
      }).catch(() => {})
    }, HEALTH_INTERVAL)
  }

  private stopHealthLoop(): void {
    if (this.healthTimer) { clearInterval(this.healthTimer); this.healthTimer = null }
  }

  private cancelRestart(): void {
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null }
  }

  private scheduleRestart(): void {
    if (this.suppressRestart || this.gaveUp || this.restartTimer) return
    const attempts = countAutoInLastHour()
    if (attempts >= MAX_RESTARTS_PER_HOUR) {
      this.gaveUp = true
      this.setStatus('gave_up')
      this.emit('gave_up', { attempts: this.restartCount })
      return
    }
    const index = Math.min(attempts, BACKOFF.length - 1)
    const delay = BACKOFF[index]
    this.emit('restarting', { attempt: this.restartCount, delayMs: delay })
    this.setStatus('restarting')
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      this.start('auto').catch(() => {})
    }, delay)
  }

  private async waitAlive(): Promise<boolean> {
    const deadline = Date.now() + BOOT_PROBE_MAX
    while (Date.now() < deadline) {
      if (await this.isAlive()) return true
      await new Promise((r) => setTimeout(r, BOOT_PROBE_INTERVAL))
    }
    return false
  }

  private async waitGone(ms: number): Promise<void> {
    const deadline = Date.now() + ms
    while (Date.now() < deadline) {
      if (!(await this.isAlive())) return
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  // ─── macOS ───

  private async startMac(): Promise<StartResult> {
    const oc = findBin('openclaw')
    try {
      await this.runOc(oc, ['gateway', 'start'])
      return { status: 'started' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const missing = /not loaded|not installed|bootstrap/i.test(msg)
      if (!missing) return { status: 'error', error: msg }
      try {
        await this.runOc(oc, ['gateway', 'install'])
        await this.runOc(oc, ['gateway', 'start'])
        return { status: 'started' }
      } catch (retryErr) {
        return { status: 'error', error: retryErr instanceof Error ? retryErr.message : String(retryErr) }
      }
    }
  }

  private async stopMac(): Promise<void> {
    try {
      const oc = findBin('openclaw')
      await this.runOc(oc, ['gateway', 'stop'])
    } catch { /* already stopped */ }
  }

  private runOc(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { env: getPathEnv() })
      let stdout = '', stderr = ''
      child.stdout.on('data', (d: Buffer) => {
        const s = d.toString()
        stdout += s
        this.log(s.trim())
      })
      child.stderr.on('data', (d: Buffer) => {
        const s = d.toString()
        stderr += s
        this.log(s.trim())
      })
      child.on('close', (code) => {
        code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `exit ${code}`))
      })
      child.on('error', reject)
    })
  }

  // ─── Windows (WSL) ───

  private async startWsl(): Promise<StartResult> {
    if (this.child) { try { this.child.kill() } catch { /* ignore */ }; this.child = null }
    await this.killWsl()
    await sleep(1000)
    this.stderrBuf = []

    return new Promise<StartResult>((resolve) => {
      const child = spawn('wsl', [
        '-d', WSL.distro, '-u', WSL.user, '--', 'bash', '-lc',
        `${WSL_NVM_INIT} NODE_OPTIONS=--dns-result-order=ipv4first openclaw gateway run`
      ], { stdio: ['ignore', 'pipe', 'pipe'] })
      this.child = child
      let resolved = false

      child.stdout.on('data', (d: Buffer) => {
        const s = d.toString().trim()
        if (s) { this.log('[gw]', s) }
        if (!resolved) { resolved = true; resolve({ status: 'started' }) }
      })
      child.stderr.on('data', (d: Buffer) => {
        const s = d.toString().trim()
        if (s) {
          this.log('[gw:err]', s)
          this.stderrBuf.push(s)
          if (this.stderrBuf.length > STDERR_TAIL * 2) this.stderrBuf = this.stderrBuf.slice(-STDERR_TAIL)
        }
        if (!resolved) { resolved = true; resolve({ status: 'started' }) }
      })
      child.on('close', (code) => {
        const wasOurs = this.child === child
        if (wasOurs) this.child = null
        this.lastExit = { code, stderrTail: this.stderrBuf.slice(-STDERR_TAIL).join('\n'), ts: Date.now() }
        if (!resolved) {
          resolved = true
          resolve(code === 0 ? { status: 'started' } : { status: 'error', error: this.stderrBuf.slice(-5).join('\n') || `exit ${code}` })
        }
        if (wasOurs && this._status === 'running') {
          this.setStatus('stopped')
          this.emit('died', this.lastExit)
          this.stopHealthLoop()
          this.scheduleRestart()
        }
      })
      child.on('error', (err) => {
        if (this.child === child) this.child = null
        if (!resolved) { resolved = true; resolve({ status: 'error', error: err.message }) }
      })
    })
  }

  private async stopWsl(): Promise<void> {
    if (this.child) { try { this.child.kill() } catch { /* ignore */ }; this.child = null }
    await this.killWsl()
    await sleep(1000)
  }

  private killWsl(): Promise<void> {
    return new Promise((resolve) => {
      const child = spawn('wsl', ['-d', WSL.distro, '-u', WSL.user, '--', 'pkill', '-9', '-f', 'openclaw'])
      child.on('close', () => resolve())
      child.on('error', () => resolve())
    })
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ──────────────────────────────────────────────
// Singleton
// ──────────────────────────────────────────────
let instance: GatewaySupervisor | null = null

export function getSupervisor(): GatewaySupervisor {
  if (!instance) instance = new GatewaySupervisor()
  return instance
}
