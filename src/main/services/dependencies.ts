/**
 * Dependency versions & install URLs — single source of truth.
 * Add new dependencies here as the installer expands.
 */
export const DEPENDENCIES = {
  nodejs: {
    minVersion: '22.16.0',
    // Built-in mirror presets
    mirrors: {
      NPMMIRROR: 'https://npmmirror.com/mirrors/node',
      OFFICIAL: 'https://nodejs.org/dist',
    } as const,
    // macOS: build .pkg URL from any mirror base
    macUrl: (mirror: string, v: string) => `${mirror.replace(/\/+$/, '')}/v${v}/node-v${v}.pkg`,
    // WSL: NodeSource setup script (installs latest of the major)
    wslSetup: (v: string) => {
      const major = v.split('.')[0]
      return `curl -fsSL https://deb.nodesource.com/setup_${major}.x | bash - && apt-get install -y nodejs`
    }
  }
} as const
