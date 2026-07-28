/**
 * Gateway restart history tracker.
 * Records restart events to a JSON file for supervisor auto-restart
 * governance (max 5 auto-restarts per hour).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

interface RestartEvent {
  ts: number
  kind: 'manual' | 'auto'
  success: boolean
  exitCode?: number | null
}

const HISTORY_FILE = join(app.getPath('userData'), 'gateway-restarts.json')
const MAX_EVENTS = 200
const ONE_HOUR = 60 * 60 * 1000

function readHistory(): RestartEvent[] {
  try {
    if (!existsSync(HISTORY_FILE)) return []
    const raw = readFileSync(HISTORY_FILE, 'utf-8')
    return JSON.parse(raw) as RestartEvent[]
  } catch { return [] }
}

function writeHistory(events: RestartEvent[]): void {
  try {
    writeFileSync(HISTORY_FILE, JSON.stringify(events.slice(-MAX_EVENTS)))
  } catch { /* best effort */ }
}

/**
 * Record a restart event.
 */
export function recordRestart(event: RestartEvent): void {
  const events = readHistory()
  events.push(event)
  writeHistory(events)
}

/**
 * Count auto-restart attempts in the last hour.
 */
export function countAutoInLastHour(): number {
  const cutoff = Date.now() - ONE_HOUR
  const events = readHistory()
  return events.filter((e) => e.kind === 'auto' && e.ts > cutoff).length
}

/**
 * Get full restart history for reports.
 */
export function getRestartHistory(): RestartEvent[] {
  return readHistory()
}
