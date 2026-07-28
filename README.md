<p align="center">
  <img src="src/renderer/src/assets/icon.svg" width="100" alt="JustClaw Logo">
</p>

<h1 align="center">JustClaw</h1>

<p align="center">
  <strong>OpenClaw AI Agent 桌面安装器 & 管理器</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-43.2.0-47848f?style=flat-square" alt="Electron">
  <img src="https://img.shields.io/badge/Vue-3.5.40-4fc08d?style=flat-square" alt="Vue">
  <img src="https://img.shields.io/badge/Vite-8.1.5-646cff?style=flat-square" alt="Vite 8">
  <img src="https://img.shields.io/badge/UnoCSS-66.7.5-8b5cf6?style=flat-square" alt="UnoCSS">
  <img src="https://img.shields.io/badge/pnpm-10-F69219?style=flat-square" alt="pnpm">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue?style=flat-square" alt="Platform">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-8b5cf6?style=flat-square" alt="License"></a>
</p>

---

## 📖 简介

**JustClaw** 是一个开源的 **OpenClaw AI Agent 桌面安装器与进程管理器**。提供图形化向导，无需打开终端即可完成 OpenClaw 的安装、配置和日常管理。

**检测 → 安装 → 使用**

---

## ✨ 功能特性

### 安装向导

- **环境自动检测** — 检测 WSL、Node.js、OpenClaw 安装状态
- **一键安装** — 自动安装 WSL、Node.js、OpenClaw
- **多 AI 提供商** — DeepSeek、MiniMax、GLM、Ollama等
- **模型列表自动更新** — 从远程拉取最新模型列表
- **npm 镜像源切换** — 官方源 / 阿里镜像 / 自定义

### Gateway 管理

- **进程监管** — 健康检查、自动重启（指数退避）
- **启动/停止/重启** — 一键管理
- **实时日志** — 按级别标识，错误行红色高亮

### 运维工具

- **配置备份/恢复**
- **AI 提供商切换**
- **故障排查** — 端口检测 + `openclaw doctor --fix`
- **系统报告收集**（PII 自动掩码）
- **统一设置面板** — 镜像源、语言可选配

---

## 🚀 快速开始

### 下载

从 [Releases](https://github.com/justclaw/justclaw/releases/latest) 下载对应平台的安装包：

| 平台 | 文件 |
|------|------|
| macOS Intel & Apple Silicon | `just-claw.dmg` |
| Windows 10+ | `just-claw-setup.exe` |

### 使用

1. **安装环境** — 启动后自动检测环境，按需安装 WSL（Windows）→ Node.js → OpenClaw
2. **配置** — 选择 AI 提供商与模型，输入 API 密钥，保存配置
3. **使用** — Gateway 自动运行，进入仪表盘监控和管理

---

## 🔧 开发

### 环境要求

- Node.js >= 22.16.0
- pnpm >= 10

### 本地开发

```bash
git clone https://github.com/justclaw/justclaw.git
cd justclaw
pnpm install
pnpm dev             # 开发模式
pnpm build           # 类型检查 + 构建
```

### 平台打包

```bash
pnpm pack:win        # Windows
pnpm pack:mac        # macOS
pnpm pack:linux      # Linux
```

---

## ⚙️ 配置管理

所有路径、用户、端口等集中管理在 `src/main/config.ts`：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `WSL.user` | Gateway 运行用户 | `openclaw`（最小权限） |
| `WSL.distro` | WSL 发行版 | `Ubuntu` |
| `GATEWAY.port` | Gateway 端口 | `18789` |
| `GATEWAY.bind` | 绑定地址 | `loopback` |

---

## 🔐 安全设计

- **渲染进程沙箱** — `sandbox: true`，最小 contextBridge API
- **CSP 策略** — 严格 Content-Security-Policy
- **参数校验** — 所有 IPC 入参经 Zod schema 校验
- **API 密钥保护** — 输入框自动隐藏中间字符
- **WSL 非特权用户** — Gateway 以 `openclaw` 用户运行
- **PII 掩码** — 系统报告自动屏蔽敏感信息
- **配置文件权限** — `0o600` 仅所有者读写

### 权限分离

WSL 中使用两个用户角色分离权限：

| 角色 | WSL 用户 | 职责 |
|------|:--------:|------|
| **系统安装** | `root` | 安装 Node.js、npm 全局包、创建用户 |
| **Gateway 运行** | `openclaw` | 运行 OpenClaw Gateway、读写配置 |

> 所有用户和路径在 `src/main/config.ts` 的 `WSL` 常量中集中定义。

---

## 📊 技术选型

| 领域 | 选型 |
|------|------|
| 桌面框架 | Electron 43 |
| 前端框架 | Vue 3.5 + Composition API |
| 构建工具 | Vite 8 (Rolldown + Oxc) |
| 状态管理 | Pinia 4 |
| 路由 | Vue Router 5 |
| 样式 | UnoCSS 66 |
| IPC 校验 | Zod 4 |
| 测试 | Vitest 4 |

---

## 📄 许可证

[MIT](LICENSE)

## 🙏 致谢

- [OpenClaw](https://github.com/openclaw/openclaw) — AI 代理框架
