/**
 * OpenClaw Configuration Manager.
 * Abstracted access to openclaw.json with a versioned schema,
 * so JustClaw is not tied to OpenClaw's internal config format (TODO 5.1).
 *
 * Schema versioning allows migration when OpenClaw changes its format.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir, platform } from 'os'
import { join } from 'path'
import { readWslFile, writeWslFileAsRoot, runInWsl, WSL_CONFIG_DIR, WSL_OC_PATH } from './wsl'
import { logger } from './logger'

// ──────────────────────────────────────────────
// Schema version
// ──────────────────────────────────────────────
const CURRENT_SCHEMA_VERSION = 1

interface JustClawMeta {
  schemaVersion: number
  managedBy: string
}

/**
 * Provider-specific OpenClaw config (baseUrl, api type, model defaults).
 * Kept here so initConfig() uses the right values per provider instead of hardcoding.
 */
export const PROVIDER_OC_CONFIG: Record<string, {
  baseUrl?: string
  api?: string
  modelDefaults: { id: string; name: string; contextWindow: number; maxTokens: number }
}> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    api: 'openai-completions',
    modelDefaults: { id: 'deepseek/deepseek-chat', name: 'deepseek-v4-flash', contextWindow: 128000, maxTokens: 8192 }
  },
  anthropic: {
    modelDefaults: { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', contextWindow: 200000, maxTokens: 8192 }
  },
  openai: {
    modelDefaults: { id: 'openai/gpt-5.5', name: 'GPT-5.5', contextWindow: 128000, maxTokens: 16384 }
  },
  google: {
    modelDefaults: { id: 'google/gemini-3-flash', name: 'Gemini 3 Flash', contextWindow: 1048576, maxTokens: 8192 }
  },
  minimax: {
    modelDefaults: { id: 'minimax/MiniMax-M3.0', name: 'MiniMax M3.0', contextWindow: 128000, maxTokens: 8192 }
  },
  glm: {
    modelDefaults: { id: 'zai/glm-5.5', name: 'GLM-5.5', contextWindow: 128000, maxTokens: 8192 }
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    modelDefaults: { id: 'ollama/llama-4', name: 'Llama 4', contextWindow: 128000, maxTokens: 4096 }
  }
}

export interface ClawConfig {
  provider: string
  apiKeyMode: 'file' | 'oauth' | 'none'
  model?: string
  openclawConfig: Record<string, unknown> // Raw OpenClaw config
  meta?: JustClawMeta
}

// ──────────────────────────────────────────────
// WSL helpers
// ──────────────────────────────────────────────
const isWin = platform() === 'win32'
const CONFIG_FILE = '.justclaw-config.json'

function getConfigPath(): string {
  if (isWin) return join(WSL_CONFIG_DIR, CONFIG_FILE).replace(/\\/g, '/')
  return join(homedir(), '.openclaw', CONFIG_FILE)
}

function getOcConfigPath(): string {
  if (isWin) return WSL_OC_PATH
  return join(homedir(), '.openclaw', 'openclaw.json')
}

async function readFile(path: string): Promise<string | null> {
  try {
    if (isWin) return await readWslFile(path)
    if (!existsSync(path)) return null
    return readFileSync(path, 'utf-8')
  } catch { return null }
}

async function writeFile(path: string, content: string): Promise<void> {
  if (isWin) await writeWslFileAsRoot(path, content)
  else writeFileSync(path, content, { mode: 0o600 })
}

async function ensureDir(dir: string): Promise<void> {
  if (isWin) await runInWsl(`mkdir -p ${dir}`, 5000).catch(() => {})
  else if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Read the managed config. Returns null if not yet configured.
 */
export async function readConfig(): Promise<ClawConfig | null> {
  const path = getConfigPath()
  logger.debug('config-manager', 'Reading config', { path })
  const raw = await readFile(path)
  if (!raw) {
    logger.debug('config-manager', 'No config found', { path })
    return null
  }
  try {
    const cfg = JSON.parse(raw) as ClawConfig
    logger.info('config-manager', 'Config read successfully', { provider: cfg.provider, apiKeyMode: cfg.apiKeyMode })
    return cfg
  } catch (err) {
    logger.error('config-manager', 'Failed to parse config', { path, error: String(err) })
    return null
  }
}

/**
 * Save managed config.
 */
export async function saveConfig(config: ClawConfig): Promise<void> {
  const baseDir = isWin ? WSL_CONFIG_DIR : join(homedir(), '.openclaw')
  const path = getConfigPath()
  await ensureDir(baseDir)
  await writeFile(path, JSON.stringify(config, null, 2))
  logger.info('config-manager', 'Config saved', { path, provider: config.provider, apiKeyMode: config.apiKeyMode })
}

/**
 * Read raw OpenClaw config, returning null if not found.
 */
export async function readOpenclawConfig(): Promise<Record<string, unknown> | null> {
  const path = getOcConfigPath()
  logger.debug('config-manager', 'Reading OpenClaw config', { path })
  const raw = await readFile(path)
  if (!raw) {
    logger.debug('config-manager', 'No OpenClaw config found')
    return null
  }
  try { return JSON.parse(raw) as Record<string, unknown> }
  catch (err) {
    logger.error('config-manager', 'Failed to parse OpenClaw config', { path, error: String(err) })
    return null
  }
}

/**
 * Write raw OpenClaw config (with metadata preservation).
 */
export async function writeOpenclawConfig(cfg: Record<string, unknown>): Promise<void> {
  const baseDir = isWin ? WSL_CONFIG_DIR : join(homedir(), '.openclaw')
  const path = getOcConfigPath()
  await ensureDir(baseDir)
  await writeFile(path, JSON.stringify(cfg, null, 2))
  const provider = ((cfg?.models as any)?.providers && Object.keys((cfg.models as any).providers)[0]) || 'unknown'
  logger.info('config-manager', 'OpenClaw config written', { path, provider })
}

/**
 * Initialize config from onboarding input.
 */
export async function initConfig(opts: {
  provider: string
  apiKey?: string
  authMethod?: 'api-key' | 'oauth'
  modelId?: string
}): Promise<void> {
  logger.info('config-manager', 'Initializing config', {
    provider: opts.provider,
    authMethod: opts.authMethod || 'api-key',
    hasApiKey: !!opts.apiKey,
    modelId: opts.modelId
  })

  // Read or create base OpenClaw config
  let ocConfig: Record<string, unknown> = {}
  const existing = await readOpenclawConfig()
  if (existing) ocConfig = existing

  // Ensure gateway mode (required by OpenClaw gateway)
  if (!ocConfig.gateway) ocConfig.gateway = {}
  if (!(ocConfig.gateway as any).mode) (ocConfig.gateway as any).mode = 'local'

  // Ensure nested structure
  if (!ocConfig.agents) ocConfig.agents = {}
  ;(ocConfig.agents as any).defaults = {
    ...(ocConfig.agents as any).defaults,
    model: { primary: opts.modelId || `${opts.provider}/default` },
    memorySearch: { provider: opts.provider, enabled: true }
  }

  // Set API key directly in config (secure, no CLI exposure)
  if (opts.apiKey && opts.authMethod !== 'oauth' && opts.provider !== 'ollama') {
    const models = (ocConfig.models as any) || {}
    if (!models.providers) models.providers = {}
    // Preserve existing provider config (baseUrl, api, models, etc.) — only update apiKey
    const existingProvider = models.providers[opts.provider] || {}
    // Use provider-specific defaults from table, falling back to generic values
    const pc = PROVIDER_OC_CONFIG[opts.provider]
    const fallbackModel = {
      id: opts.modelId || pc?.modelDefaults.id || `${opts.provider}/default`,
      name: opts.modelId ? opts.modelId.split('/').pop() || opts.modelId : (pc?.modelDefaults.name || `${opts.provider}/default`),
      contextWindow: pc?.modelDefaults.contextWindow ?? 128000,
      maxTokens: pc?.modelDefaults.maxTokens ?? 8192
    }
    models.providers[opts.provider] = {
      ...existingProvider,
      // Only add baseUrl/api if the provider config specifies them (don't overwrite existing)
      ...(pc?.baseUrl && !existingProvider.baseUrl ? { baseUrl: pc.baseUrl } : {}),
      ...(pc?.api && !existingProvider.api ? { api: pc.api } : {}),
      apiKey: opts.apiKey,
      // Only set fallback model if no models exist yet (CLI/patch already wrote correct ones)
      models: existingProvider.models?.length ? existingProvider.models : [fallbackModel]
    }
    if (!ocConfig.models) ocConfig.models = {}
    ;(ocConfig.models as any).providers = models.providers
  }

  // Save OpenClaw config
  await writeOpenclawConfig(ocConfig)

  // Save JustClaw managed metadata
  const clawConfig: ClawConfig = {
    provider: opts.provider,
    apiKeyMode: opts.authMethod === 'oauth' ? 'oauth' : opts.provider === 'ollama' ? 'none' : 'file',
    model: opts.modelId,
    openclawConfig: ocConfig,
    meta: { schemaVersion: CURRENT_SCHEMA_VERSION, managedBy: 'justclaw' }
  }
  await saveConfig(clawConfig)
}

/**
 * Get config file path for reports.
 */
export function getConfigPaths(): { justclaw: string; openclaw: string } {
  return { justclaw: getConfigPath(), openclaw: getOcConfigPath() }
}
