import { platform } from 'os'
import { join } from 'path'

/**
 * macOS: directories to search for binaries.
 */
export const PATH_DIRS = [
  '/usr/local/bin',
  '/opt/homebrew/bin',
  process.env.NVM_BIN ?? '',
  `${process.env.HOME}/.volta/bin`,
  `${process.env.HOME}/.npm-global/bin`,
  '/usr/bin',
  '/bin'
].filter(Boolean)

/**
 * Returns a process env with an extended PATH (macOS).
 * Removes NODE_OPTIONS to prevent referencing deleted files.
 */
export function getPathEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  env.PATH = [...PATH_DIRS, process.env.PATH ?? ''].join(':')
  delete env.NODE_OPTIONS
  return env
}

/**
 * Find a binary by searching PATH_DIRS.
 * Falls back to bare name if not found.
 */
export function findBin(name: string): string {
  if (platform() === 'win32') return name
  for (const dir of PATH_DIRS) {
    const p = join(dir, name)
    try {
      const { statSync } = require('fs')
      const st = statSync(p)
      if (st.isFile() || st.isSymbolicLink()) return p
    } catch {
      continue
    }
  }
  return name
}
