import { createI18n } from 'vue-i18n'

/**
 * i18n setup with Chinese as default (matching user preference).
 * Supports zh, en, ko, ja.
 */
const messages = {
  zh: {
    settings: {
      title: '设置',
      npmRegistry: 'npm 镜像源',
      language: '语言',
            moreComing: '更多设置即将到来...'
    },
    common: {
      app: { title: 'JustClaw', subtitle: 'OpenClaw AI 代理安装器' },
      button: { back: '返回', next: '继续', start: '开始', retry: '重试', cancel: '取消', delete: '删除', update: '更新', confirm: '确定', dashboard: '继续', close: '关闭', maximize: '最大化', minimize: '最小化' },
      status: {
        notInstalled: '未安装',
        installing: '安装中...',
        updating: '更新中...',
        completed: '已完成',
        failed: '失败'
      }
    },
    steps: {
      welcome: { title: '一键安装 OpenClaw AI 代理', desc: 'OpenClaw AI 代理安装 & 管理工具', start: '开始安装', ready: '环境就绪，开始配置', needsSetup: '需要安装运行组件', checking: '环境检测中...', installNow: '一键安装', configureNow: '配置 AI 提供商' },
      setup: {
        title: '安装组件', desc: '自动检测并安装所需组件',
        waiting: '等待中', doing: '安装中...', done: '已完成', error: '失败', skip: '已就绪', missing: '未安装',
        os: '操作系统', wsl: 'WSL', ubuntu: 'Ubuntu', nodejs: 'Node.js', openclaw: 'OpenClaw',
        retry: '重试', installing: '正在安装，请稍候...',
        registryTitle: 'npm 镜像源（安装失败时可切换）',
        registryOfficial: '官方源', registryAli: '阿里镜像', registryCustom: '自定义',
        registryPlaceholder: 'https://registry.example.com/',
        nodeMirror: 'Node.js 镜像源',
        nodeMirrorOfficial: '官方源', nodeMirrorAli: '阿里云'
      },
      config: {
        title: '选择 AI 厂商', desc: '选择 AI 厂商、模型并输入 API 密钥',
        selectProvider: '请选择厂商',
        selectProviderHint: '请先选择一个 AI 厂商开始配置',
        modelSelect: '选择模型', updateModels: '更新', updateFail: '获取失败', updateNetworkError: '网络异常',
        apiKey: 'API 密钥', apiKeyPlaceholder: '在此粘贴你的 API 密钥',
        keyFormatHint: '密钥格式不正确',
        save: '保存', saving: '保存中...',
        getKey: '获取密钥', downloadOllama: '下载 Ollama',
        noKeyNeeded: '无需 API 密钥',
        oauthLogin: '使用 OpenAI 账号登录', loggingIn: '登录中...',
        authMethod: { 'api-key': 'API 密钥', oauth: 'OAuth 登录' },
        configuring: '正在配置...'
      },
      indicator: { setup: '安装', config: '配置', done: '管理' }
    },
    management: {
      done: {
        title: '管理',
        gatewayRunning: 'Gateway 运行中',
        gatewayStarting: '启动中...',
        gatewayStopped: 'Gateway 已停止',
        aiModel: 'AI 模型',
        changeModel: '切换',
        startBtn: '启动', stopBtn: '停止', restartBtn: '重启',
        showLog: '显示日志', hideLog: '隐藏日志',
        errorDetected: '检测到错误',
        gatewayRestarting: 'Gateway 正在重启...',
        gatewayFailed: 'Gateway 运行失败',
        autoLaunch: '自启',
        troubleshoot: '检查',
        modifyConfig: '修改配置',
        backup: '备份',
        restore: '恢复',
        reportLabel: '报告',
        copyReport: '系统报告',
        reset: '重置',
        delete: '卸载',
        settingsBackup: '备份',
        starDesc: '在 GitHub 上支持我们',
        kakaoChat: '联系支持',
        kakaoChatDesc: '遇到问题？联系我们',
        errorPrefix: '错误：{msg}',
        restartingGw: '正在重启 Gateway...',
        ocUpdateAvailable: 'OpenClaw {latest} 可用',
        ocCurrentVersion: '当前版本 {current}',
        ocAutoUpdating: '正在自动更新到 {to}...',
        ocAutoUpdated: '已自动更新 {from} → {to}',
        ocAutoUpdateFailed: '自动更新失败：{msg}'
      },
      uninstall: {
        title: '卸载', desc: '确定要卸载 OpenClaw 吗？',
        removeConfig: '同时删除配置文件', uninstallAll: '卸载全部组件', preparing: '正在准备卸载...',
        completed: '卸载完成', errorFallback: '卸载失败',
        stoppingGw: '正在停止 Gateway...',
        removing: '正在移除 OpenClaw...',
        removingConfig: '正在删除配置文件...',
        done: '卸载完成'
      },
      reset: {
        title: '重新配置', desc: '清除当前配置，重新运行安装向导。\nOpenClaw 本身不会卸载。',
        preparing: '正在准备...', completed: '配置已重置',
        confirm: '确认重置', errorFallback: '重置失败'
      },
      backupRestore: {
        backupProgress: '正在备份...', backupDone: '备份完成！', backupError: '备份失败',
        restoreTitle: '恢复设置', restoreDesc: '选择之前备份的文件恢复配置',
        restoreProgress: '正在恢复...', restoreDone: '恢复完成！', restoreError: '恢复失败',
        selectFile: '选择备份文件'
      }
    },
    troubleshoot: {
      title: '环境检查', reDiagnose: '重新检查',
      envCheck: '环境检测', gatewayStatus: '网关状态', portCheck: '端口检测',
      ok: '正常', warn: '警告', error: '错误',
      running: '运行中', stopped: '已停止', starting: '启动中', restarting: '重启中', idle: '空闲', failed: '失败'
    }
  },
  en: {
    settings: {
      title: 'Settings',
      npmRegistry: 'npm Registry',
      language: 'Language',
            moreComing: 'More settings coming soon...'
    },
    common: {
      app: { title: 'JustClaw', subtitle: 'OpenClaw AI Agent Installer' },
      button: { back: 'Back', next: 'Next', start: 'Start', retry: 'Retry', cancel: 'Cancel', delete: 'Delete', update: 'Update', confirm: 'OK', dashboard: 'Continue', close: 'Close', maximize: 'Maximize', minimize: 'Minimize' },
      status: {
        notInstalled: 'Not installed',
        installing: 'Installing...',
        updating: 'Updating...',
        completed: 'Completed',
        failed: 'Failed'
      }
    },
    steps: {
      welcome: { title: 'Install OpenClaw AI Agent in One Click', desc: 'OpenClaw AI Agent Installer & Manager', start: 'Get Started', ready: 'Environment ready', needsSetup: 'Setup required', checking: 'Checking environment...', installNow: 'Install Now', configureNow: 'Configure AI Provider' },
      setup: {
        title: 'Setup Components', desc: 'Auto-detect and install components',
        waiting: 'Waiting', doing: 'Installing...', done: 'Done', error: 'Failed', skip: 'Ready', missing: 'Not installed',
        os: 'OS', wsl: 'WSL', ubuntu: 'Ubuntu', nodejs: 'Node.js', openclaw: 'OpenClaw',
        retry: 'Retry', installing: 'Installing, please wait...',
        registryTitle: 'npm Registry (switch mirror on failure)',
        registryOfficial: 'Official', registryAli: 'Alibaba Mirror', registryCustom: 'Custom',
        registryPlaceholder: 'https://registry.example.com/',
        nodeMirror: 'Node.js Mirror',
        nodeMirrorOfficial: 'Official', nodeMirrorAli: 'Alibaba'
      },
      config: {
        title: 'Select AI Provider', desc: 'Choose provider, model and enter API key',
        selectProvider: 'Select provider',
        selectProviderHint: 'Select a provider to start configuring',
        modelSelect: 'Select Model', updateModels: 'Update', updateFail: 'Failed', updateNetworkError: 'Network error',
        apiKey: 'API Key', apiKeyPlaceholder: 'Paste your API key',
        keyFormatHint: 'Invalid key format',
        save: 'Save', saving: 'Saving...',
        getKey: 'Get API Key', downloadOllama: 'Download Ollama',
        noKeyNeeded: 'No API key needed',
        oauthLogin: 'Sign in with OpenAI', loggingIn: 'Signing in...',
        authMethod: { 'api-key': 'API Key', oauth: 'OAuth Login' },
        configuring: 'Configuring...'
      },
      indicator: { setup: 'Setup', config: 'Config', done: 'Manage' }
    },
    management: {
      done: {
        title: 'Manage',
        gatewayRunning: 'Gateway Running', gatewayStarting: 'Starting...', gatewayStopped: 'Gateway Stopped',
        aiModel: 'AI Model', changeModel: 'Change',
        startBtn: 'Start', stopBtn: 'Stop', restartBtn: 'Restart',
        showLog: 'Show Log', hideLog: 'Hide Log', errorDetected: 'Error detected',
        gatewayRestarting: 'Gateway restarting...', gatewayFailed: 'Gateway failed',
        autoLaunch: 'Auto', troubleshoot: 'Check', modifyConfig: 'Modify Config', backup: 'Backup', restore: 'Restore',
        reportLabel: 'Report', copyReport: 'Report', reset: 'Reset', delete: 'Uninstall',
        settingsBackup: 'Backup', starDesc: 'Star on GitHub',
        kakaoChat: 'Support', kakaoChatDesc: 'Need help?',
        errorPrefix: 'Error: {msg}', restartingGw: 'Restarting gateway...',
        ocUpdateAvailable: 'OpenClaw {latest} available', ocCurrentVersion: 'current {current}',
        ocAutoUpdating: 'Auto-updating to {to}...', ocAutoUpdated: 'Updated {from} → {to}', ocAutoUpdateFailed: 'Update failed: {msg}'
      },
      uninstall: { title: 'Uninstall', desc: 'Remove OpenClaw?', removeConfig: 'Remove config files', uninstallAll: 'Uninstall all components', preparing: 'Preparing...', completed: 'Uninstalled', errorFallback: 'Uninstall failed', stoppingGw: 'Stopping Gateway...', removing: 'Removing OpenClaw...', removingConfig: 'Removing config...', done: 'Done' },
      reset: { title: 'Reconfigure', desc: 'Clear config and re-run wizard.\nOpenClaw stays installed.', preparing: 'Preparing...', completed: 'Config reset', confirm: 'Reset', errorFallback: 'Reset failed' },
      backupRestore: { backupProgress: 'Backing up...', backupDone: 'Backup done!', backupError: 'Backup failed', restoreTitle: 'Restore', restoreDesc: 'Pick a backup file', restoreProgress: 'Restoring...', restoreDone: 'Restored!', restoreError: 'Restore failed', selectFile: 'Select File' }
    },
    troubleshoot: { title: 'Check', reDiagnose: 'Re-check', envCheck: 'Environment', gatewayStatus: 'Gateway', portCheck: 'Port', ok: 'OK', warn: 'Warning', error: 'Error', running: 'Running', stopped: 'Stopped', starting: 'Starting', restarting: 'Restarting', idle: 'Idle', failed: 'Failed' }
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: 'zh',
  fallbackLocale: 'en',
  messages
})
