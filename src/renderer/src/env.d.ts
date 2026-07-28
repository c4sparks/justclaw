/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

/**
 * Electron preload API type declaration.
 */

type OsType = 'macos' | 'windows' | 'linux'
type WslStateType = 'not_available' | 'not_installed' | 'needs_reboot' | 'no_distro' | 'not_initialized' | 'ready'
type GatewayStatusType = 'idle' | 'starting' | 'running' | 'restarting' | 'stopped' | 'failed' | 'gave_up'
type ProviderType = 'anthropic' | 'google' | 'openai' | 'minimax' | 'glm' | 'deepseek' | 'ollama'
type AuthMethodType = 'api-key' | 'oauth'

interface ElectronAPI {
  version(): Promise<string>
  env: {
    check(): Promise<{
      os: OsType
      osVersion?: string
      nodeInstalled: boolean
      nodeVersion: string | null
      nodeVersionOk: boolean
      openclawInstalled: boolean
      openclawVersion: string | null
      openclawLatestVersion: string | null
      wslState?: WslStateType
      wslVersion?: string
      distroVersion?: string
    }>
  }
  install: {
    node(mirror?: string): Promise<{ success: boolean; error?: string }>
    openclaw(registry?: string): Promise<{ success: boolean; error?: string }>
    onProgress(cb: (msg: string) => void): () => void
    onError(cb: (msg: string) => void): () => void
  }
  onboard: {
    run(config: {
      provider: string
      apiKey?: string
      authMethod?: string
      modelId?: string
    }): Promise<{ success: boolean; error?: string; botUsername?: string }>
  }
  oauth: {
    loginCodex(): Promise<{ success: boolean; error?: string }>
  }
  config: {
    read(): Promise<{ success: boolean; config: { provider?: string; model?: string; hasApiKey?: boolean; apiKey?: string } | null; error?: string }>
    reset(): Promise<{ success: boolean; error?: string }>
    switchProvider(config: { provider: string; apiKey?: string; authMethod?: string; modelId?: string }): Promise<{ success: boolean; error?: string }>
  }
  gateway: {
    start(): Promise<{ success: boolean; error?: string }>
    stop(): Promise<{ success: boolean; error?: string }>
    restart(): Promise<{ success: boolean; error?: string }>
    status(): Promise<GatewayStatusType>
    onLog(cb: (msg: string) => void): () => void
    onStatusChanged(cb: (p: { status: string }) => void): () => void
    onRestarting(cb: (p: { attempt: number; delayMs: number }) => void): () => void
    onRestarted(cb: () => void): () => void
    onGaveUp(cb: (p: { attempts: number }) => void): () => void
    onDied(cb: (p: { code: number | null; ts: number }) => void): () => void
  }
  config: {
    update(opts: { provider: string; apiKey?: string; authMethod?: string; modelId?: string }): Promise<{ success: boolean; error?: string }>
  }
  openclaw: {
    checkUpdate(): Promise<{ currentVersion: string | null; latestVersion: string | null }>
    autoUpdateNow(): Promise<{ success: boolean }>
    fetchModels(provider: string): Promise<{ id: string; name: string; desc?: string; price?: string }[]>
    getDashboardUrl(): Promise<string>
  }
  wsl: {
    check(): Promise<WslStateType | undefined>
    install(prevState?: string): Promise<{ success: boolean; needsReboot?: boolean; state?: string; error?: string }>
  }
  troubleshoot: {
    checkPort(): Promise<{ inUse: boolean; pid?: string }>
    doctorFix(): Promise<{ success: boolean }>
  }
  report: {
    collect(): Promise<{ timestamp: number; text: string }>
    copy(text: string): Promise<{ success: boolean; error?: string }>
  }
  reboot(): void
  openExternal(url: string): Promise<void>
  autoLaunch: {
    get(): Promise<{ enabled: boolean }>
    set(enabled: boolean): Promise<{ success: boolean }>
  }
  config: {
    read(): Promise<{ success: boolean; config: { provider?: string; model?: string; apiKey?: string; hasApiKey?: boolean } | null }>
  }
  uninstall: {
    openclaw(opts: { removeConfig: boolean }): Promise<{ success: boolean; error?: string }>
    nodejs(): Promise<{ success: boolean; error?: string }>
    wsl(): Promise<{ success: boolean; error?: string }>
    onProgress(cb: (msg: string) => void): () => void
  }
  backup: {
    export(): Promise<{ success: boolean; error?: string }>
    import(): Promise<{ success: boolean; error?: string }>
  }
  i18n: {
    getLocale(): Promise<string>
    setLanguage(lng: string): Promise<{ success: boolean; error?: string }>
  }
  wizard: {
    saveState(state: { step: string; wslInstalled: boolean; timestamp: number }): Promise<{ success: boolean }>
    loadState(): Promise<{ step: string; wslInstalled: boolean; timestamp: number } | null>
    clearState(): Promise<{ success: boolean }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
