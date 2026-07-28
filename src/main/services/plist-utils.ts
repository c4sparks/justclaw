/**
 * macOS plist utility — manages launchd plist for OpenClaw Gateway.
 * Uses the `plist` library instead of string replacement (TODO 3.5).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir, platform } from 'os'
import { join } from 'path'
import { app } from 'electron'
import { spawn } from 'child_process'

const PLIST_PATH = join(homedir(), 'Library', 'LaunchAgents', 'ai.openclaw.gateway.plist')
const LOG_DIR = join(app.getPath('userData'), 'logs')
const STDOUT_PATH = join(LOG_DIR, 'launchd-gateway.out.log')
const STDERR_PATH = join(LOG_DIR, 'launchd-gateway.err.log')
const IPV4_FIX_PATH = join(homedir(), '.openclaw', 'ipv4-fix.js')

/**
 * Ensure log directory exists.
 */
function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
}

/**
 * Read the existing plist, or return null.
 */
function readPlist(): any | null {
  if (!existsSync(PLIST_PATH)) return null
  try {
    const { parse } = require('plist')
    const xml = readFileSync(PLIST_PATH, 'utf-8')
    return parse(xml)
  } catch { return null }
}

/**
 * Write plist object to file as XML.
 */
function writePlist(obj: any): void {
  const { build } = require('plist')
  const xml = build(obj)
  writeFileSync(PLIST_PATH, xml)
}

/**
 * Reload a launchd service by GUID.
 */
function reloadLaunchd(uid: number): void {
  spawn('launchctl', ['bootout', `gui/${uid}/ai.openclaw.gateway`])
    .on('close', () => {
      setTimeout(() => {
        spawn('launchctl', ['bootstrap', `gui/${uid}`, PLIST_PATH])
      }, 500)
    })
}

/**
 * Patch the gateway plist to add stdout/stderr logging paths.
 * Idempotent — skips if already present.
 */
export function patchGatewayPlist(): void {
  if (platform() !== 'darwin') return

  const plist = readPlist()
  if (!plist) return

  // Check if already patched
  if (plist.StandardOutPath) return

  ensureLogDir()
  plist.StandardOutPath = STDOUT_PATH
  plist.StandardErrorPath = STDERR_PATH
  writePlist(plist)

  // Reload launchd
  const uid = process.getuid?.() ?? 501
  reloadLaunchd(uid)
}

/**
 * Add NODE_OPTIONS env var with IPv4 fix to the plist.
 */
export function patchGatewayNodeOptions(): void {
  if (platform() !== 'darwin') return

  const plist = readPlist()
  if (!plist) return

  // Check if NODE_OPTIONS already set
  if (plist.EnvironmentVariables?.NODE_OPTIONS?.includes('ipv4-fix')) return

  plist.EnvironmentVariables = {
    ...plist.EnvironmentVariables,
    NODE_OPTIONS: `--require=${IPV4_FIX_PATH}`
  }

  writePlist(plist)

  const uid = process.getuid?.() ?? 501
  reloadLaunchd(uid)
}

/**
 * Remove NODE_OPTIONS from the plist (for clean uninstall).
 */
export function unsetGatewayNodeOptions(): void {
  if (platform() !== 'darwin') return

  const plist = readPlist()
  if (!plist) return

  if (plist.EnvironmentVariables) {
    delete plist.EnvironmentVariables.NODE_OPTIONS
    if (Object.keys(plist.EnvironmentVariables).length === 0) {
      delete plist.EnvironmentVariables
    }
  }
  writePlist(plist)
}
