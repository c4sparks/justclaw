import { ipcMain, app, BrowserWindow, clipboard, shell } from 'electron'
import { spawn } from 'child_process'
import { platform } from 'os'
import { z } from 'zod'
import { IPC } from '../shared/types'
import type { EnvCheckResult, GatewayStatus } from '../shared/types'
import { checkEnvironment, checkOpenclawUpdate } from './services/env-checker'
import { getSupervisor } from './services/gateway-supervisor'
import { installNode, installOpenClaw } from './services/installer'
import { checkPort, runDoctorFix } from './services/troubleshooter'
import { collectReport } from './services/report-collector'
import { checkWslState, runInWsl, readWslFile, WSL_CONFIG_DIR, WSL_OC_PATH } from './services/wsl'
import { findBin, getPathEnv } from './services/path-utils'
import { runOnboard } from './services/onboarder'
import { loginOpenAICodex } from './services/oauth'
import { exportBackup, importBackup } from './services/backup'
import { WSL } from './config'
import { readConfig } from './services/config-manager'
import { logger } from './services/logger'
import type { GatewayStatusPayload, GatewayRestartingPayload, GatewayDiedPayload, GatewayGaveUpPayload, WizardState } from '@shared/types'

// ──────────────────────────────────────────────
// Zod schemas — IPC parameter validation
// ──────────────────────────────────────────────
const ProviderSchema = z.enum([
  'anthropic', 'google', 'openai', 'minimax', 'glm', 'deepseek', 'ollama'
])
const AuthMethodSchema = z.enum(['api-key', 'oauth'])
const LanguageSchema = z.enum(['en', 'zh'])

const OnboardConfigSchema = z.object({
  provider: ProviderSchema,
  apiKey: z.string().optional(),
  authMethod: AuthMethodSchema.optional(),
  modelId: z.string().optional()
})

const SwitchProviderSchema = z.object({
  provider: ProviderSchema,
  apiKey: z.string().optional(),
  authMethod: AuthMethodSchema.optional(),
  modelId: z.string().optional()
})

const UninstallOptionsSchema = z.object({
  removeConfig: z.boolean()
})

// ──────────────────────────────────────────────
// Logger (file + console fallback)
// ──────────────────────────────────────────────
const log = (msg: string): void => logger.info('ipc', msg)
const logError = (ctx: string, err: unknown): void =>
  logger.error('ipc', `${ctx}: ${err instanceof Error ? err.message : String(err)}`)

// ──────────────────────────────────────────────
// Register all IPC handlers
// ──────────────────────────────────────────────
export const registerIpcHandlers = (getWin: () => BrowserWindow | null): void => {
  const win = (): BrowserWindow => {
    const w = getWin()
    if (!w || w.isDestroyed()) throw new Error('No active window')
    return w
  }

  // ── App ──
  ipcMain.handle(IPC.APP_VERSION, () => app.getVersion())

  // ── Environment ──
  ipcMain.handle(IPC.ENV_CHECK, async (): Promise<EnvCheckResult> => {
    log('env:check')
    return checkEnvironment()
  })

  // ── WSL ──
  ipcMain.handle(IPC.WSL_CHECK, async () => checkWslState())

  ipcMain.handle(IPC.WSL_INSTALL, async (_e, prevState?: string) => {
    log(`wsl:install (prevState=${prevState})`)
    const wslTs = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}` }
    const sendProgress = (msg: string) => {
      try { win().webContents.send(IPC.INSTALL_PROGRESS, `${wslTs()} ${msg}`) } catch {}
    }

    const WSL_ORDER: string[] = ['not_available', 'not_installed', 'needs_reboot', 'no_distro', 'not_initialized', 'ready']
    const baseline = prevState || 'not_installed'

    sendProgress('Installing WSL, please click "Yes" on the UAC dialog...')

    try {
      const psCmd = [
        'try {',
        "  $p = Start-Process -FilePath 'wsl' -ArgumentList '--install -d Ubuntu --no-launch --web-download' -Verb RunAs -Wait -PassThru -WindowStyle Normal;",
        '  exit $p.ExitCode',
        '} catch {',
        '  Write-Output $_.Exception.Message;',
        '  exit 1',
        '}'
      ].join(' ')

      await new Promise<void>((resolve, reject) => {
        const child = spawn('powershell', ['-NoProfile', '-Command', psCmd])
        let output = ''
        child.stdout.on('data', (d: Buffer) => { output += d.toString() })
        child.stderr.on('data', (d: Buffer) => { output += d.toString() })
        child.on('close', (code) => {
          sendProgress(`WSL install command finished (exit code: ${code})`)
          if (code === 0) { resolve(); return }
          const msg = output.toLowerCase()
          if (code === -1 || code === 4294967295) { resolve(); return }
          if (/canceled|cancelled|elevation|access denied|permission/i.test(msg)) {
            reject(new Error('需要管理员权限，请在 UAC 对话框中点击"是"'))
          } else if (/not recognized|not found/i.test(msg)) {
            reject(new Error('当前 Windows 版本不支持 WSL'))
          } else if (/virtualization|hyper-v/i.test(msg)) {
            reject(new Error('请在 BIOS 中开启虚拟化(VT-x/AMD-V)'))
          } else {
            reject(new Error(`WSL 安装失败 (${output.trim().slice(0, 200)})`))
          }
        })
        child.on('error', (err) => reject(new Error(`启动安装程序失败: ${err.message}`)))
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const newState = await checkWslState().catch(() => 'not_available' as any)
      if (newState !== baseline && WSL_ORDER.indexOf(newState) > WSL_ORDER.indexOf(baseline)) {
        sendProgress('WSL 状态已更新')
        return { success: true, needsReboot: newState === 'needs_reboot', state: newState }
      }
      logError('wsl:install', err)
      return { success: false, error: msg }
    }

    // Poll until ready or timeout
    sendProgress('Waiting for WSL initialization...')
    const pollStart = Date.now()
    const POLL_TIMEOUT = 300_000
    const POLL_INTERVAL = 3000
    let newState: string = 'not_installed'

    while (Date.now() - pollStart < POLL_TIMEOUT) {
      newState = await checkWslState()
      if (newState === 'ready' || newState === 'needs_reboot') break
      await new Promise((r) => setTimeout(r, POLL_INTERVAL))
    }

    const needsReboot = newState === 'needs_reboot'

    if (newState === 'ready' || WSL_ORDER.indexOf(newState) > WSL_ORDER.indexOf(baseline)) {
      sendProgress(needsReboot ? 'Reboot required to complete WSL installation' : 'WSL is ready')
      return { success: true, needsReboot, state: newState }
    }

    return { success: false, error: 'WSL 安装后状态未改变，请检查系统日志' }
  })

  // ── Install ──
  ipcMain.handle(IPC.INSTALL_NODE, async () => {
    log('install:node')
    try {
      await installNode(win())
      log('install:node done')
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logError('install:node', err)
      try { win().webContents.send(IPC.INSTALL_ERROR, msg) } catch { /* ignore */ }
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.INSTALL_OPENCLAW, async (_e, registry?: string) => {
    log(`install:openclaw registry=${registry ?? 'default'}`)
    try {
      await installOpenClaw(win(), registry)
      log('install:openclaw done')
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logError('install:openclaw', err)
      try { win().webContents.send(IPC.INSTALL_ERROR, msg) } catch { /* ignore */ }
      return { success: false, error: msg }
    }
  })

  // ── Onboard ──
  ipcMain.handle(IPC.ONBOARD_RUN, async (_e, config: unknown) => {
    try {
      const validated = OnboardConfigSchema.parse(config)
      log(`onboard:run provider=${validated.provider}`)
      const result = await runOnboard(win(), validated)
      return { success: true, botUsername: result.botUsername }
    } catch (err) {
      logError('onboard:run', err)
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── OAuth ──
  ipcMain.handle(IPC.OAUTH_OPENAI_CODEX, async () => {
    log('oauth:openai-codex')
    try {
      await loginOpenAICodex(win())
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logError('oauth:openai-codex', err)
      // cancelled by user is not an error
      if (msg === 'cancelled') return { success: false, error: msg }
      return { success: false, error: msg }
    }
  })

  // ── Gateway ──
  const supervisor = getSupervisor()

  // Broadcast supervisor events to renderer
  supervisor.on('status-changed', (s: GatewayStatus) => {
    try { win().webContents.send(IPC.GATEWAY_STATUS_CHANGED, { status: s } satisfies GatewayStatusPayload) } catch { /* ignore */ }
  })
  supervisor.on('restarting', (p: GatewayRestartingPayload) => {
    try { win().webContents.send(IPC.GATEWAY_RESTARTING, p) } catch { /* ignore */ }
  })
  supervisor.on('restarted', () => {
    try { win().webContents.send(IPC.GATEWAY_RESTARTED) } catch { /* ignore */ }
  })
  supervisor.on('gave_up', (p: GatewayGaveUpPayload) => {
    try { win().webContents.send(IPC.GATEWAY_GAVE_UP, p) } catch { /* ignore */ }
  })
  supervisor.on('died', (p: GatewayDiedPayload) => {
    try { win().webContents.send(IPC.GATEWAY_DIED, p) } catch { /* ignore */ }
  })
  supervisor.on('log', (msg: string) => {
    try { win().webContents.send(IPC.GATEWAY_LOG, msg.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')) } catch { /* ignore */ }
  })

  ipcMain.handle(IPC.GATEWAY_START, async () => {
    log('gateway:start')
    try {
      const result = await supervisor.start()
      return { success: result.status === 'started', error: result.error }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.GATEWAY_STOP, async () => {
    log('gateway:stop')
    try { await supervisor.stop(); return { success: true } }
    catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) } }
  })

  ipcMain.handle(IPC.GATEWAY_RESTART, async () => {
    log('gateway:restart')
    try {
      const result = await supervisor.restart()
      return { success: result.status === 'started', error: result.error }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.GATEWAY_STATUS, async (): Promise<GatewayStatus> => supervisor.getStatus())

  // ── Gateway log forwarding ──
  // Already handled via supervisor events above

  // ── Troubleshoot ──
  ipcMain.handle(IPC.TROUBLESHOOT_CHECK_PORT, async () => {
    log('troubleshoot:check-port')
    return checkPort()
  })
  ipcMain.handle(IPC.TROUBLESHOOT_DOCTOR_FIX, async () => {
    log('troubleshoot:doctor-fix')
    return runDoctorFix()
  })

  // ── Report ──
  ipcMain.handle(IPC.REPORT_COLLECT, async () => {
    log('report:collect')
    return collectReport()
  })
  ipcMain.handle(IPC.REPORT_COPY, async (_e, text: string) => {
    try {
      clipboard.writeText(text)
      return { success: true }
    } catch { return { success: false } }
  })

  // ── System ──
  ipcMain.on(IPC.SYSTEM_REBOOT, () => {
    if (platform() !== 'win32') return
    log('system:reboot')
    const child = spawn('shutdown', ['/r', '/t', '0'], { detached: true, stdio: 'ignore' })
    child.unref()
  })
  ipcMain.handle(IPC.OPEN_EXTERNAL, async (_e, url: string) => {
    log(`system:open-external ${url}`)
    await shell.openExternal(url)
  })

  // ── Auto Launch ──
  ipcMain.handle(IPC.AUTO_LAUNCH_GET, () => ({
    enabled: app.getLoginItemSettings().openAtLogin
  }))
  ipcMain.handle(IPC.AUTO_LAUNCH_SET, (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
    return { success: true }
  })

  // ── Uninstall ──
  ipcMain.handle(IPC.UNINSTALL_OPENCLAW, async (_e, opts: unknown) => {
    try {
      const validated = UninstallOptionsSchema.parse(opts)
      log(`uninstall:openclaw removeConfig=${validated.removeConfig}`)
      const sendProgress = (msg: string) => {
        try { win().webContents.send(IPC.UNINSTALL_PROGRESS, msg) } catch {}
      }

      // 1. Stop gateway
      sendProgress('正在停止 Gateway...')
      const sup = getSupervisor()
      await sup.stop().catch(() => {})

      // 2. npm uninstall -g openclaw
      sendProgress('正在卸载 OpenClaw...')
      const isWin = platform() === 'win32'
      if (isWin) {
        const { runInWslAsRoot } = await import('./services/wsl')
        await runInWslAsRoot('npm uninstall -g openclaw', 60000)
      } else {
        const { execSync } = await import('child_process')
        execSync('npm uninstall -g openclaw', { timeout: 120000 })
      }

      // 3. Remove config (always — uninstall should be clean)
      sendProgress('正在删除配置文件...')
      if (isWin) {
        const { runInWslAsRoot, runInWsl } = await import('./services/wsl')
        const { getWslConfigDir } = await import('./config')
        await runInWslAsRoot(`rm -rf ${getWslConfigDir('root')}`, 15000)
        await runInWsl(`rm -rf ${WSL.configDir}`, 15000)
      } else {
        const { rm } = await import('fs/promises')
        const { join } = await import('path')
        const { homedir } = await import('os')
        await rm(join(homedir(), '.openclaw'), { recursive: true, force: true }).catch(() => {})
      }

      sendProgress('验证卸载结果...')
      const ocStill = isWin
        ? (await (await import('./services/wsl')).runInWsl('which openclaw 2>/dev/null || echo not_found', 5000)).trim()
        : (await import('child_process')).execSync('which openclaw 2>/dev/null || echo not_found', { encoding: 'utf8', timeout: 5000 }).trim()
      if (ocStill !== 'not_found') {
        sendProgress('OpenClaw 卸载可能不完整，请检查')
      } else {
        sendProgress('卸载完成')
      }
      return { success: true }
    } catch (err) {
      logError('uninstall:openclaw', err)
      return { success: false, error: String(err) }
    }
  })

  // ── Backup ──
  ipcMain.handle(IPC.BACKUP_EXPORT, async () => {
    log('backup:export')
    try { return await exportBackup(win()) }
    catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) } }
  })
  ipcMain.handle(IPC.BACKUP_IMPORT, async () => {
    log('backup:import')
    try { return await importBackup(win()) }
    catch (err) { return { success: false, error: err instanceof Error ? err.message : String(err) } }
  })

  // ── OpenClaw update ──
  ipcMain.handle(IPC.OPENCLAW_CHECK_UPDATE, async () => {
    try {
      return await checkOpenclawUpdate()
    } catch {
      return { currentVersion: null, latestVersion: null }
    }
  })

  
        // ---- OpenClaw fetch models ----
  // Built-in model registry (fallback if remote fetch fails)
  const BUILTIN_MODELS: Record<string, { id: string; name: string; desc?: string; price?: string }[]> = {
    anthropic: [
      { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', desc: 'Latest Balanced', price: '$3/$15' },
      { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', desc: 'Latest Top Performance', price: '$15/$75' },
      { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5', desc: 'Fast & Affordable', price: '$0.80/$4' },
    ],
    openai: [
      { id: 'openai/gpt-5.5', name: 'GPT-5.5', desc: 'Latest Top Performance', price: '$2.50/$15' },
      { id: 'openai/gpt-5.5-mini', name: 'GPT-5.5 Mini', desc: 'Fast & Affordable', price: '$0.75/$4.50' },
    ],
    google: [
      { id: 'google/gemini-3-flash', name: 'Gemini 3 Flash', desc: 'Latest Fast', price: '$0.15/$0.60' },
      { id: 'google/gemini-3-pro', name: 'Gemini 3 Pro', desc: 'Latest High Performance', price: '$1.25/$5' },
    ],
    deepseek: [
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', desc: 'Latest', price: '$0.27/$0.40' },
      { id: 'deepseek/deepseek-reasoner', name: 'DeepSeek Reasoner', desc: 'Reasoning', price: '$0.55/$2.19' },
      { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', desc: 'Fast & Affordable', price: '$0.20/$0.40' },
    ],
    minimax: [
      { id: 'minimax/MiniMax-M3.0', name: 'MiniMax M3.0', desc: 'Latest', price: '$0.30/$1.2' },
    ],
    glm: [
      { id: 'zai/glm-5.5', name: 'GLM-5.5', desc: 'Latest Top Performance', price: '$1/$3.2' },
    ],
    ollama: [
      { id: 'ollama/llama-4', name: 'Llama 4', desc: 'General Purpose', price: 'Free' },
      { id: 'ollama/qwen3', name: 'Qwen 3', desc: 'High Performance', price: 'Free' },
    ],
  }

  ipcMain.handle(IPC.OPENCLAW_FETCH_MODELS, async (_e, provider: string) => {
    log(`openclaw:fetch-models provider=${provider}`)
    const models = BUILTIN_MODELS[provider] ?? []
    if (models.length === 0) return []

    try {
      const url = `https://raw.githubusercontent.com/openclaw/openclaw/main/packages/ai/src/providers/${provider}-models.json`
      const https = await import('https')
      const data = await new Promise<string>((resolve, reject) => {
        const req = https.get(url, (res) => {
          if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return }
          let body = ''
          res.on('data', (chunk) => body += chunk.toString())
          res.on('end', () => resolve(body))
        })
        req.on('error', reject)
        req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
      })
      const parsed = JSON.parse(data)
      const fetched = Array.isArray(parsed) ? parsed : (parsed.models ?? parsed.data ?? [])
      if (fetched.length > 0) {
        return fetched.map((m: any) => ({
          id: m.id || m.model || `${provider}/${m.name || ''}`,
          name: m.name || m.displayName || m.id,
          desc: m.description || m.desc || '',
          price: m.price || '',
        }))
      }
    } catch { /* remote unavailable, use built-in */ }

    return models
  })

// ---- OpenClaw auto-update ----
ipcMain.handle(IPC.OPENCLAW_AUTO_UPDATE_NOW, async () => {
    log('openclaw:auto-update-now')
    try {
      const isWin = platform() === 'win32'
      if (isWin) {
        const { runInWslAsRoot, runInWsl } = await import('./services/wsl')
        await runInWslAsRoot('npm install -g openclaw@latest', 300000)
        // 以 gateway 用户身份修复配置兼容性
        await runInWsl('openclaw doctor --fix 2>&1', 30000)
      } else {
        await new Promise<void>((resolve, reject) => {
          const child = spawn('npm', ['install', '-g', 'openclaw@latest'], { env: getPathEnv() })
          child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)))
          child.on('error', reject)
        })
      }
      return { success: true }
    } catch (err) {
      logError('openclaw:auto-update-now', err)
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ---- OpenClaw dashboard URL ----
  ipcMain.handle(IPC.OPENCLAW_DASHBOARD_URL, async () => {
    try {
      const isWin = platform() === 'win32'
      if (isWin) {
        const { runInWslAsRoot } = await import('./services/wsl')
        const raw = await runInWslAsRoot(`cat ${WSL.configPath}`, 10000).catch(() => '{}')
        const cfg = JSON.parse(raw)
        const token = cfg.gateway?.auth?.token || ''
        return 'http://127.0.0.1:18789/?token=' + token
      }
      return 'http://127.0.0.1:18789'
    } catch { return 'http://127.0.0.1:18789' }
  })

  // ── Config ──
  ipcMain.handle(IPC.CONFIG_READ, async () => {
    try {
      const { existsSync, readFileSync } = await import('fs')
      const { join } = await import('path')
      const { homedir } = await import('os')
      const isWin = platform() === 'win32'
      let raw: string
      if (isWin) {
        raw = await readWslFile(WSL_OC_PATH)
      } else {
        const p = join(homedir(), '.openclaw', 'openclaw.json')
        if (!existsSync(p)) return { success: true, config: null }
        raw = readFileSync(p, 'utf-8')
      }
      const cfg = JSON.parse(raw)
      const model = cfg?.agents?.defaults?.model?.primary as string | undefined
      // 优先从 JustClaw 元数据读取供应商（保存的是原始值），避免 model?.split('/')[0] 推导错误
      let provider: string | undefined
      try {
        const clawConfig = await readConfig()
        if (clawConfig?.provider) provider = clawConfig.provider
      } catch { /* fall through */ }
      if (!provider) {
        // 从 OpenClaw 配置的 providers 对象取第一个 key 作为供应商
        const providerKeys = (cfg?.models?.providers || {}) as Record<string, unknown>
        const keys = Object.keys(providerKeys)
        if (keys.length > 0) provider = keys[0]
      }
      if (!provider) provider = model?.split('/')[0]
      // Also check if any provider has an API key configured (onboarder patching)
      const allProviders = (cfg?.models?.providers || {}) as Record<string, { apiKey?: string }>
      const hasApiKey = Object.values(allProviders).some((p: any) => p?.apiKey)
      const apiKey = provider ? allProviders[provider]?.apiKey : undefined
      return { success: true, config: { provider, model, hasApiKey, apiKey } }
    } catch {
      return { success: true, config: null }
    }
  })

  ipcMain.handle(IPC.CONFIG_RESET, async () => {
    log('config:reset')
    try {
      // Stop gateway first
      await supervisor.stop().catch(() => {})
      const isWin = platform() === 'win32'
      if (isWin) {
        const { runInWsl } = await import('./services/wsl')
        await runInWsl(`rm -f ${WSL_OC_PATH}`, 10000).catch(() => {})
        await runInWsl(`rm -f ${WSL_CONFIG_DIR}/.justclaw-config.json`, 10000).catch(() => {})
      } else {
        const { rm } = await import('fs/promises')
        const { join } = await import('path')
        const { homedir } = await import('os')
        const dir = join(homedir(), '.openclaw')
        // Remove both config files
        await rm(join(dir, 'openclaw.json'), { force: true }).catch(() => {})
        await rm(join(dir, '.justclaw-config.json'), { force: true }).catch(() => {})
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Wizard State (reboot-persist) ──
  const wizardStatePath = () => {
    const { join } = require('path')
    return join(app.getPath('userData'), 'wizard-state.json')
  }

  ipcMain.handle('wizard:save-state', async (_e, state: WizardState) => {
    try {
      const { writeFileSync } = require('fs')
      writeFileSync(wizardStatePath(), JSON.stringify(state))
      return { success: true }
    } catch { return { success: false } }
  })

  ipcMain.handle('wizard:load-state', async () => {
    try {
      const { existsSync, readFileSync, unlinkSync } = require('fs')
      const p = wizardStatePath()
      if (!existsSync(p)) return null
      const state: WizardState = JSON.parse(readFileSync(p, 'utf-8'))
      if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
        unlinkSync(p)
        return null
      }
      return state
    } catch { return null }
  })

  ipcMain.handle('wizard:clear-state', async () => {
    try {
      const { existsSync, unlinkSync } = require('fs')
      const p = wizardStatePath()
      if (existsSync(p)) unlinkSync(p)
      return { success: true }
    } catch { return { success: false } }
  })

  // ── Auto Update (Electron app) ──
  const UPDATE_CHANNELS = {
    check: 'update:check',
    download: 'update:download',
    install: 'update:install',
    available: 'update:available',
    progress: 'update:progress',
    downloaded: 'update:downloaded',
    error: 'update:error'
  } as const

  // Wire up electron-updater events to renderer (skip in dev)
  const isDev = process.env['ELECTRON_RENDERER_URL'] || process.argv.includes('--dev')
  if (!isDev) {
    try {
      const { autoUpdater } = require('electron-updater')
      autoUpdater.autoDownload = false
      autoUpdater.autoInstallOnAppQuit = true

      autoUpdater.on('update-available', (info: any) => {
        try { win().webContents.send(UPDATE_CHANNELS.available, { version: info.version }) } catch {}
      })
      autoUpdater.on('download-progress', (p: any) => {
        try { win().webContents.send(UPDATE_CHANNELS.progress, Math.round(p.percent)) } catch {}
      })
      autoUpdater.on('update-downloaded', () => {
        try { win().webContents.send(UPDATE_CHANNELS.downloaded) } catch {}
      })
      autoUpdater.on('error', (e: Error) => {
        try { win().webContents.send(UPDATE_CHANNELS.error, e.message) } catch {}
      })
    } catch { /* electron-updater not available */ }
  }

  ipcMain.handle(UPDATE_CHANNELS.check, async () => {
    log('update:check')
    try {
      const { autoUpdater } = require('electron-updater')
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch { return { success: false } }
  })
  ipcMain.handle(UPDATE_CHANNELS.download, async () => {
    log('update:download')
    try {
      const { autoUpdater } = require('electron-updater')
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch { return { success: false } }
  })
  ipcMain.handle(UPDATE_CHANNELS.install, async () => {
    log('update:install')
    try {
      const { autoUpdater } = require('electron-updater')
      autoUpdater.quitAndInstall()
      return { success: true }
    } catch { return { success: false } }
  })

  // ── i18n ──
  ipcMain.handle(IPC.I18N_GET_LOCALE, () => {
    const sys = app.getLocale()
    if (sys.startsWith('zh')) return 'zh'
    return 'en'
  })
  ipcMain.handle(IPC.I18N_SET_LANGUAGE, async (_e, lng: string) => {
    try {
      const validated = LanguageSchema.parse(lng)
      log(`i18n:set-language ${validated}`)
      // Persist to settings file
      const { writeFileSync } = require('fs')
      const { join } = require('path')
      const settingsPath = join(app.getPath('userData'), 'settings.json')
      const settings = { language: validated }
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
      // Rebuild tray menu (menu text changes with locale)
      try {
        const { Menu } = require('electron')
        // Tray tooltip is static, but the context menu will be rebuilt
        // on next poll cycle automatically
      } catch { /* ignore */ }
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
