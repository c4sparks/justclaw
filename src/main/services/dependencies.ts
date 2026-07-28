/**
 * Dependency versions & install URLs — single source of truth.
 * Add new dependencies here as the installer expands.
 */
export const DEPENDENCIES = {
  nodejs: {
    minVersion: '22.16.0',
    // macOS: official installer
    macUrl: (v: string) => `https://nodejs.org/dist/v${v}/node-v${v}.pkg`,
    // WSL: NodeSource setup script (installs latest of the major)
    wslSetup: (v: string) => {
      const major = v.split('.')[0]
      return `curl -fsSL https://deb.nodesource.com/setup_${major}.x | bash - && apt-get install -y nodejs`
    }
  }
} as const
