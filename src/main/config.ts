/**
 * JustClaw 统一配置
 * ================
 * 所有用户、路径、端口等集中管理，方便维护。
 *
 * 用户说明：
 *   - openclaw: Gateway 运行时用户（最小权限）
 *   - root:     安装/系统操作用户
 *
 * 目录说明：
 *   - /home/openclaw/.openclaw/  Gateway 读取配置的路径（openclaw 用户）
 *   - /root/.openclaw/           root 用户配置路径（备用）
 */

import { platform } from 'os'

const isWin = platform() === 'win32'

/** WSL Gateway 运行用户名（最小权限），集中定义，避免各处写死 */
export const WSL_USER = 'openclaw'

// ── WSL ──
export const WSL = {
  /** WSL 发行版名称 */
  distro: 'Ubuntu',
  /** Gateway 运行用户（最小权限） */
  user: WSL_USER,
  /** 系统操作用户 */
  rootUser: 'root',
  /** Gateway 配置目录 */
  configDir: `/home/${WSL_USER}/.openclaw`,
  /** Gateway 配置文件路径 */
  configPath: `/home/${WSL_USER}/.openclaw/openclaw.json`,
} as const

// ── Gateway ──
export const GATEWAY = {
  /** Gateway HTTP 端口 */
  port: 18789,
  /** 绑定地址 */
  bind: 'loopback',
  /** 健康检查 URL */
  healthUrl: 'http://127.0.0.1:18789/health',
  /** Dashboard URL */
  dashboardUrl: 'http://127.0.0.1:18789',
  /** WSL 启动命令 */
  wslRunCmd: (nvmInit: string) =>
    `bash -lc '${nvmInit} NODE_OPTIONS=--dns-result-order=ipv4first openclaw gateway run'`,
} as const

// ── 路径 ──
export const PATHS = {
  /** WSL 中 nvm init 脚本 */
  wslNvmInit:
    'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null; ',
} as const

// ── 依赖版本 ──
export const DEPENDENCIES = {
  nodejs: {
    minVersion: '22.16.0',
    macUrl: (v: string) => `https://nodejs.org/dist/v${v}/node-v${v}.pkg`,
    wslSetup: (v: string) => {
      const major = v.split('.')[0]
      return `curl -fsSL https://deb.nodesource.com/setup_${major}.x | bash - && apt-get install -y nodejs`
    }
  }
} as const

// ── 快捷访问 ──
/** 获取 WSL 配置路径（按用户） */
export function getWslPath(user: 'openclaw' | 'root'): string {
  const home = user === 'root' ? '/root' : `/home/${user}`
  return `${home}/.openclaw/openclaw.json`
}

/** 获取 WSL 配置目录（按用户） */
export function getWslConfigDir(user: 'openclaw' | 'root'): string {
  const home = user === 'root' ? '/root' : `/home/${user}`
  return `${home}/.openclaw`
}
