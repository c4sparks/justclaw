import { spawn } from 'child_process'
import { platform, homedir } from 'os'
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { getPathEnv, findBin } from './path-utils'
import { readWslFile, writeWslFileAsRoot, runInWsl, WSL_CONFIG_DIR, WSL_OC_PATH } from './wsl'
import type { BrowserWindow } from 'electron'
import { WSL } from '../config'
import { initConfig, PROVIDER_OC_CONFIG } from './config-manager'
import { logger } from './logger'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
export interface OnboardConfig {
  provider: 'anthropic' | 'google' | 'openai' | 'minimax' | 'glm' | 'deepseek' | 'ollama'
  apiKey?: string
  authMethod?: 'api-key' | 'oauth'
  modelId?: string
}

export interface OnboardResult {
  botUsername?: string
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const isWin = platform() === 'win32'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function createRunner(onLog: (msg: string) => void): (cmd: string, args: string[]) => Promise<void> {
  return (cmd, args) => new Promise((resolve, reject) => {
    let fullCmd: string
    let fullArgs: string[]

    if (isWin) {
      const script = `${cmd} ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`
      fullCmd = 'wsl'
      fullArgs = ['-d', WSL.distro, '-u', WSL.user, '--', 'bash', '-lc',
        'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null; ' + script]
    } else {
      fullCmd = cmd
      fullArgs = args
    }

    const child = spawn(fullCmd, fullArgs, { env: isWin ? process.env : getPathEnv() })
    const stripEmoji = (s: string) => s.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim()
    child.stdout.on('data', (d: Buffer) => d.toString().split('\n').map(stripEmoji).filter(Boolean).forEach(onLog))
    child.stderr.on('data', (d: Buffer) => d.toString().split('\n').map(stripEmoji).filter(Boolean).forEach(onLog))
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Command failed with exit code ${code}`)))
    child.on('error', reject)
  })
}

/**
 * Patch the config JSON after onboard with provider API key and model info.
 * Used for DeepSeek (not built-in) and model spec patching.
 */
function patchConfigWithProvider(cfg: any, provider: string, apiKey?: string, modelId?: string): void {
  if (apiKey) {
    cfg.models = cfg.models ?? {}
    cfg.models.providers = cfg.models.providers ?? {}
    const pc = PROVIDER_OC_CONFIG[provider]
    const fallbackId = modelId || pc?.modelDefaults.id || `${provider}/default`
    cfg.models.providers[provider] = {
      ...(pc?.baseUrl ? { baseUrl: pc.baseUrl } : {}),
      ...(pc?.api ? { api: pc.api } : {}),
      apiKey,
      models: [
        { id: fallbackId, name: pc?.modelDefaults.name || fallbackId.split('/').pop() || fallbackId, contextWindow: pc?.modelDefaults.contextWindow ?? 128000, maxTokens: pc?.modelDefaults.maxTokens ?? 8192 }
      ]
    }
  }
}

function readConfig(isWin: boolean): Promise<any> {
  if (isWin) {
    return readWslFile(WSL_OC_PATH).then(JSON.parse).catch(() => null)
  }
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  try { return Promise.resolve(JSON.parse(readFileSync(configPath, 'utf-8'))) } catch { return Promise.resolve(null) }
}

function writeConfig(isWin: boolean, cfg: any): Promise<void> {
  if (isWin) {
    return writeWslFileAsRoot(WSL_OC_PATH, JSON.stringify(cfg, null, 2)).catch(() => {})
  }
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  writeFileSync(configPath, JSON.stringify(cfg, null, 2), { mode: 0o600 })
  return Promise.resolve()
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────
export async function runOnboard(win: BrowserWindow, config: OnboardConfig): Promise<OnboardResult> {
  const log = (msg: string) => { try { win.webContents.send('install:progress', msg) } catch {} }

  const authMethod = config.authMethod === 'oauth' ? 'OAuth'
    : config.provider === 'ollama' ? 'no key (local)'
    : config.apiKey ? `API key (…${config.apiKey.slice(-4)})`
    : 'none'
  logger.info('onboarder', 'Starting onboard', { provider: config.provider, authMethod: authMethod.replace(/\(….*\)/, '(masked)') })
  log(`Configuring OpenClaw — provider: ${config.provider}, auth: ${authMethod}`)

  // Build auth flags — pass API key via CLI
  const effectiveAuthFlags: string[] =
    config.authMethod === 'oauth'
      ? ['--auth-choice', 'skip']
      : config.provider === 'ollama'
        ? ['--auth-choice', 'ollama']
        : config.provider === 'deepseek'
          ? ['--auth-choice', 'deepseek-api-key', '--deepseek-api-key', config.apiKey!]
          : {
              anthropic: ['--auth-choice', 'apiKey', '--anthropic-api-key', config.apiKey!],
              google: ['--auth-choice', 'gemini-api-key', '--gemini-api-key', config.apiKey!],
              openai: ['--auth-choice', 'openai-api-key', '--openai-api-key', config.apiKey!],
              minimax: ['--auth-choice', 'minimax-api', '--minimax-api-key', config.apiKey!],
              glm: ['--auth-choice', 'zai-api-key', '--zai-api-key', config.apiKey!]
            }[config.provider] ?? ['--auth-choice', 'skip']

  const ocBin = isWin ? 'openclaw' : findBin('openclaw')
  const runCmd = createRunner(log)

  log(`Running: openclaw onboard --non-interactive --mode local (provider: ${config.provider})`)

  const openclawArgs = [
    'onboard',
    '--non-interactive',
    '--accept-risk',
    '--mode', 'local',
    ...effectiveAuthFlags,
    '--gateway-port', '18789',
    '--gateway-bind', 'loopback',
    ...(isWin ? [] : ['--install-daemon', '--daemon-runtime', 'node']),
    '--skip-skills'
  ]

  try {
    await runCmd(ocBin, openclawArgs)
    logger.info('onboarder', 'openclaw onboard CLI succeeded')
    log('openclaw onboard completed')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.warn('onboarder', 'openclaw onboard CLI failed, falling back to direct config patch', { error: msg })
    log(`openclaw onboard exited (${msg}) — falling back to direct config patch`)
  }

  // Post-patch: add DeepSeek provider + model config (not built-in)
  if (config.apiKey && config.provider === 'deepseek') {
    log('Patching DeepSeek provider config...')
    try {
      const cfg = await readConfig(isWin)
      if (cfg) {
        patchConfigWithProvider(cfg, config.provider, config.apiKey, config.modelId)
        await writeConfig(isWin, cfg)
        logger.info('onboarder', 'DeepSeek config patched successfully')
        log('DeepSeek provider configured')
      } else {
        logger.warn('onboarder', 'Could not read config for DeepSeek patching')
        log('Could not read OpenClaw config for DeepSeek patch')
      }
    } catch (err) {
      logger.error('onboarder', 'Failed to patch DeepSeek config', { error: String(err) })
      log(`Failed to patch DeepSeek config: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 写入 JustClaw 元数据
  try {
    await initConfig({
      provider: config.provider,
      apiKey: config.apiKey,
      authMethod: config.authMethod,
      modelId: config.modelId
    })
    logger.info('onboarder', 'JustClaw metadata saved', { provider: config.provider, modelId: config.modelId })
  } catch (err) {
    logger.warn('onboarder', 'Failed to save JustClaw metadata, non-fatal', { error: String(err) })
    log(`Could not save metadata: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 配置修复
  try {
    log('Running openclaw doctor --fix...')
    if (isWin) {
      const { runInWsl } = await import('./wsl')
      await runInWsl('openclaw doctor --fix 2>&1', 30000)
    } else {
      const { execSync } = await import('child_process')
      execSync('openclaw doctor --fix', { timeout: 30000 })
    }
    logger.info('onboarder', 'openclaw doctor --fix succeeded')
    log('Configuration validated')
  } catch (err) {
    logger.warn('onboarder', 'doctor --fix failed (non-fatal)', { error: String(err) })
    log('Configuration validation skipped')
  }

  logger.info('onboarder', 'Onboard finished successfully', { provider: config.provider })
  log('Configuration complete')
  return {}
}
