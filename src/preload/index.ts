/**
 * Preload script — contextBridge API for the renderer.
 * Self-contained, no imports from shared (avoids alias resolution issues
 * in sandboxed preload environments).
 */
import { contextBridge, ipcRenderer } from 'electron'

// ── IPC channel constants (mirrors src/shared/types.ts) ──
const IPC = {
  APP_VERSION: 'app:version',
  ENV_CHECK: 'env:check',
  OPENCLAW_CHECK_UPDATE: 'openclaw:check-update',
  OPENCLAW_AUTO_UPDATE_NOW: 'openclaw:auto-update-now',
  OPENCLAW_FETCH_MODELS: 'openclaw:fetch-models',
  OPENCLAW_DASHBOARD_URL: 'openclaw:dashboard-url',
  WSL_CHECK: 'wsl:check',
  WSL_INSTALL: 'wsl:install',
  INSTALL_NODE: 'install:node',
  INSTALL_OPENCLAW: 'install:openclaw',
  INSTALL_PROGRESS: 'install:progress',
  INSTALL_ERROR: 'install:error',
  ONBOARD_RUN: 'onboard:run',
  OAUTH_OPENAI_CODEX: 'oauth:openai-codex',
  CONFIG_READ: 'config:read',
  CONFIG_RESET: 'config:reset',
  CONFIG_SWITCH_PROVIDER: 'config:switch-provider',
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
  TROUBLESHOOT_CHECK_PORT: 'troubleshoot:check-port',
  TROUBLESHOOT_DOCTOR_FIX: 'troubleshoot:doctor-fix',
  REPORT_COLLECT: 'report:collect',
  REPORT_COPY: 'report:copy',
  SYSTEM_REBOOT: 'system:reboot',
  OPEN_EXTERNAL: 'system:open-external',
  AUTO_LAUNCH_GET: 'autolaunch:get',
  AUTO_LAUNCH_SET: 'autolaunch:set',
  UNINSTALL_OPENCLAW: 'uninstall:openclaw',
  UNINSTALL_PROGRESS: 'uninstall:progress',
  BACKUP_EXPORT: 'backup:export',
  BACKUP_IMPORT: 'backup:import',
  I18N_GET_LOCALE: 'i18n:get-locale',
  I18N_SET_LANGUAGE: 'i18n:set-language',
  WIZARD_SAVE_STATE: 'wizard:save-state',
  WIZARD_LOAD_STATE: 'wizard:load-state',
  WIZARD_CLEAR_STATE: 'wizard:clear-state',
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_PROGRESS: 'update:progress',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_ERROR: 'update:error'
} as const

// ── Typed API bridge ──
const electronAPI = {
  version: (): Promise<string> => ipcRenderer.invoke(IPC.APP_VERSION),

  env: {
    check: (): Promise<any> => ipcRenderer.invoke(IPC.ENV_CHECK)
  },

  openclaw: {
    checkUpdate: (): Promise<any> => ipcRenderer.invoke(IPC.OPENCLAW_CHECK_UPDATE),
    autoUpdateNow: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC.OPENCLAW_AUTO_UPDATE_NOW),
    fetchModels: (provider: string): Promise<any> => ipcRenderer.invoke(IPC.OPENCLAW_FETCH_MODELS, provider),
    getDashboardUrl: (): Promise<string> => ipcRenderer.invoke(IPC.OPENCLAW_DASHBOARD_URL)
  },

  wsl: {
    check: (): Promise<any> => ipcRenderer.invoke(IPC.WSL_CHECK),
    install: (prevState?: string): Promise<any> => ipcRenderer.invoke(IPC.WSL_INSTALL, prevState)
  },

  install: {
    node: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IPC.INSTALL_NODE),
    openclaw: (registry?: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IPC.INSTALL_OPENCLAW, registry),
    onProgress: (cb: (msg: string) => void): (() => void) => {
      const h = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on(IPC.INSTALL_PROGRESS, h)
      return () => ipcRenderer.removeListener(IPC.INSTALL_PROGRESS, h)
    },
    onError: (cb: (msg: string) => void): (() => void) => {
      const h = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on(IPC.INSTALL_ERROR, h)
      return () => ipcRenderer.removeListener(IPC.INSTALL_ERROR, h)
    }
  },

  onboard: {
    run: (config: any): Promise<any> => ipcRenderer.invoke(IPC.ONBOARD_RUN, config)
  },

  oauth: {
    loginCodex: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IPC.OAUTH_OPENAI_CODEX)
  },

  config: {
    read: (): Promise<any> => ipcRenderer.invoke(IPC.CONFIG_READ),
    reset: (): Promise<any> => ipcRenderer.invoke(IPC.CONFIG_RESET),
    switchProvider: (config: any): Promise<any> => ipcRenderer.invoke(IPC.CONFIG_SWITCH_PROVIDER, config)
  },

  gateway: {
    start: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IPC.GATEWAY_START),
    stop: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IPC.GATEWAY_STOP),
    restart: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IPC.GATEWAY_RESTART),
    status: (): Promise<string> => ipcRenderer.invoke(IPC.GATEWAY_STATUS),
    onLog: (cb: (msg: string) => void): (() => void) => {
      const h = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on(IPC.GATEWAY_LOG, h)
      return () => ipcRenderer.removeListener(IPC.GATEWAY_LOG, h)
    },
    onStatusChanged: (cb: (p: any) => void): (() => void) => {
      const h = (_: unknown, p: any): void => cb(p)
      ipcRenderer.on(IPC.GATEWAY_STATUS_CHANGED, h)
      return () => ipcRenderer.removeListener(IPC.GATEWAY_STATUS_CHANGED, h)
    },
    onRestarting: (cb: (p: any) => void): (() => void) => {
      const h = (_: unknown, p: any): void => cb(p)
      ipcRenderer.on(IPC.GATEWAY_RESTARTING, h)
      return () => ipcRenderer.removeListener(IPC.GATEWAY_RESTARTING, h)
    },
    onRestarted: (cb: () => void): (() => void) => {
      const h = (): void => cb()
      ipcRenderer.on(IPC.GATEWAY_RESTARTED, h)
      return () => ipcRenderer.removeListener(IPC.GATEWAY_RESTARTED, h)
    },
    onGaveUp: (cb: (p: any) => void): (() => void) => {
      const h = (_: unknown, p: any): void => cb(p)
      ipcRenderer.on(IPC.GATEWAY_GAVE_UP, h)
      return () => ipcRenderer.removeListener(IPC.GATEWAY_GAVE_UP, h)
    },
    onDied: (cb: (p: any) => void): (() => void) => {
      const h = (_: unknown, p: any): void => cb(p)
      ipcRenderer.on(IPC.GATEWAY_DIED, h)
      return () => ipcRenderer.removeListener(IPC.GATEWAY_DIED, h)
    }
  },

  troubleshoot: {
    checkPort: (): Promise<any> => ipcRenderer.invoke(IPC.TROUBLESHOOT_CHECK_PORT),
    doctorFix: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC.TROUBLESHOOT_DOCTOR_FIX)
  },

  report: {
    collect: (): Promise<{ timestamp: number; text: string }> => ipcRenderer.invoke(IPC.REPORT_COLLECT),
    copy: (text: string): Promise<any> => ipcRenderer.invoke(IPC.REPORT_COPY, text)
  },

  reboot: (): void => ipcRenderer.send(IPC.SYSTEM_REBOOT),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),

  autoLaunch: {
    get: (): Promise<{ enabled: boolean }> => ipcRenderer.invoke(IPC.AUTO_LAUNCH_GET),
    set: (enabled: boolean): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC.AUTO_LAUNCH_SET, enabled)
  },

  uninstall: {
    openclaw: (opts: { removeConfig: boolean }): Promise<any> => ipcRenderer.invoke(IPC.UNINSTALL_OPENCLAW, opts),
    onProgress: (cb: (msg: string) => void): (() => void) => {
      const h = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on(IPC.UNINSTALL_PROGRESS, h)
      return () => ipcRenderer.removeListener(IPC.UNINSTALL_PROGRESS, h)
    }
  },

  backup: {
    export: (): Promise<any> => ipcRenderer.invoke(IPC.BACKUP_EXPORT),
    import: (): Promise<any> => ipcRenderer.invoke(IPC.BACKUP_IMPORT)
  },

  i18n: {
    getLocale: (): Promise<string> => ipcRenderer.invoke(IPC.I18N_GET_LOCALE),
    setLanguage: (lng: string): Promise<any> => ipcRenderer.invoke(IPC.I18N_SET_LANGUAGE, lng)
  },

  wizard: {
    saveState: (state: any): Promise<any> => ipcRenderer.invoke(IPC.WIZARD_SAVE_STATE, state),
    loadState: (): Promise<any> => ipcRenderer.invoke(IPC.WIZARD_LOAD_STATE),
    clearState: (): Promise<any> => ipcRenderer.invoke(IPC.WIZARD_CLEAR_STATE)
  },

  // Electron app auto-update
  update: {
    check: (): Promise<any> => ipcRenderer.invoke(IPC.UPDATE_CHECK),
    download: (): Promise<any> => ipcRenderer.invoke(IPC.UPDATE_DOWNLOAD),
    install: (): Promise<any> => ipcRenderer.invoke(IPC.UPDATE_INSTALL),
    onAvailable: (cb: (info: any) => void): (() => void) => {
      const h = (_: unknown, info: any): void => cb(info)
      ipcRenderer.on(IPC.UPDATE_AVAILABLE, h)
      return () => ipcRenderer.removeListener(IPC.UPDATE_AVAILABLE, h)
    },
    onProgress: (cb: (pct: number) => void): (() => void) => {
      const h = (_: unknown, pct: number): void => cb(pct)
      ipcRenderer.on(IPC.UPDATE_PROGRESS, h)
      return () => ipcRenderer.removeListener(IPC.UPDATE_PROGRESS, h)
    },
    onDownloaded: (cb: () => void): (() => void) => {
      const h = (): void => cb()
      ipcRenderer.on(IPC.UPDATE_DOWNLOADED, h)
      return () => ipcRenderer.removeListener(IPC.UPDATE_DOWNLOADED, h)
    },
    onError: (cb: (msg: string) => void): (() => void) => {
      const h = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on(IPC.UPDATE_ERROR, h)
      return () => ipcRenderer.removeListener(IPC.UPDATE_ERROR, h)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
