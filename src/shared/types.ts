// ──────────────────────────────────────────────
// IPC Channel Names (single source of truth)
// ──────────────────────────────────────────────
export const IPC = {
  // App
  APP_VERSION: 'app:version',

  // Environment
  ENV_CHECK: 'env:check',
  OPENCLAW_CHECK_UPDATE: 'openclaw:check-update',
  OPENCLAW_AUTO_UPDATE_NOW: 'openclaw:auto-update-now',
  OPENCLAW_FETCH_MODELS: 'openclaw:fetch-models',
  OPENCLAW_DASHBOARD_URL: 'openclaw:dashboard-url',

  // WSL
  WSL_CHECK: 'wsl:check',
  WSL_INSTALL: 'wsl:install',

  // Install
  INSTALL_NODE: 'install:node',
  INSTALL_OPENCLAW: 'install:openclaw',
  INSTALL_PROGRESS: 'install:progress',
  INSTALL_ERROR: 'install:error',

  // Onboard / Config
  ONBOARD_RUN: 'onboard:run',
  CONFIG_READ: 'config:read',
  CONFIG_RESET: 'config:reset',
  CONFIG_SWITCH_PROVIDER: 'config:switch-provider',

  // OAuth
  OAUTH_OPENAI_CODEX: 'oauth:openai-codex',

  // Gateway
  GATEWAY_START: 'gateway:start',
  GATEWAY_STOP: 'gateway:stop',
  GATEWAY_RESTART: 'gateway:restart',
  GATEWAY_STATUS: 'gateway:status',
  GATEWAY_LOG: 'gateway:log',
  GATEWAY_STATUS_CHANGED: 'gateway:status-changed',
  GATEWAY_RESTARTING: 'gateway:restarting',
  GATEWAY_RESTARTED: 'gateway:restarted',
  GATEWAY_GAVE_UP: 'gateway:gave-up',
  GATEWAY_DIED: 'gateway:died',

  // Troubleshoot
  TROUBLESHOOT_CHECK_PORT: 'troubleshoot:check-port',
  TROUBLESHOOT_DOCTOR_FIX: 'troubleshoot:doctor-fix',

  // Report
  REPORT_COLLECT: 'report:collect',
  REPORT_COPY: 'report:copy',

  // System
  SYSTEM_REBOOT: 'system:reboot',
  OPEN_EXTERNAL: 'system:open-external',

  // Auto launch
  AUTO_LAUNCH_GET: 'autolaunch:get',
  AUTO_LAUNCH_SET: 'autolaunch:set',

  // Uninstall
  UNINSTALL_OPENCLAW: 'uninstall:openclaw',
  UNINSTALL_NODE: 'uninstall:node',
  UNINSTALL_WSL: 'uninstall:wsl',
  UNINSTALL_PROGRESS: 'uninstall:progress',

  // Backup
  BACKUP_EXPORT: 'backup:export',
  BACKUP_IMPORT: 'backup:import',

  // i18n
  I18N_GET_LOCALE: 'i18n:get-locale',
  I18N_SET_LANGUAGE: 'i18n:set-language'
} as const

// ──────────────────────────────────────────────
// Domain Types
// ──────────────────────────────────────────────
export type WslState =
  | 'not_available'
  | 'not_installed'
  | 'needs_reboot'
  | 'no_distro'
  | 'not_initialized'
  | 'ready'

export type Provider =
  | 'anthropic'
  | 'google'
  | 'openai'
  | 'minimax'
  | 'glm'
  | 'deepseek'
  | 'ollama'

export type AuthMethod = 'api-key' | 'oauth'

export type GatewayStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'restarting'
  | 'stopped'
  | 'failed'
  | 'gave_up'

export type OsType = 'macos' | 'windows' | 'linux'

export interface EnvCheckResult {
  os: OsType
  osVersion?: string
  nodeInstalled: boolean
  nodeVersion: string | null
  nodeVersionOk: boolean
  openclawInstalled: boolean
  openclawVersion: string | null
  openclawLatestVersion: string | null
  wslState?: WslState
  wslVersion?: string
  distroVersion?: string
}

export interface OnboardConfig {
  provider: Provider
  apiKey?: string
  authMethod?: AuthMethod
  modelId?: string
}

export interface OnboardResult {
  success: boolean
  error?: string
  botUsername?: string
}

export interface CurrentConfig {
  provider?: string
  model?: string
  hasApiKey?: boolean
  apiKey?: string
}

export interface GatewayStatusPayload {
  status: GatewayStatus
}

export interface GatewayRestartingPayload {
  attempt: number
  delayMs: number
}

export interface GatewayDiedPayload {
  code: number | null
  ts: number
}

export interface GatewayGaveUpPayload {
  attempts: number
}

export interface PortCheckResult {
  inUse: boolean
  pid?: string
}

export interface VersionInfo {
  currentVersion: string | null
  latestVersion: string | null
}

export interface WizardState {
  step: string
  wslInstalled: boolean
  timestamp: number
}

export interface ModelOption {
  id: string
  name: string
  desc: string
  price?: string
}

export interface ProviderConfig {
  id: Provider
  label: string
  placeholder: string
  pattern: RegExp
  models: ModelOption[]
  oauthModels?: ModelOption[]
  authMethods?: AuthMethod[]
}

export interface AutoUpdateEvent {
  started?: { from: string; to: string }
  progress?: { msg?: string }
  done?: { from: string; to: string }
  error?: { error?: string }
}
