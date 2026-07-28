import { app } from 'electron'
import { join } from 'path'
import { createWriteStream, existsSync, mkdirSync, type WriteStream } from 'fs'

// ──────────────────────────────────────────────
// Structured file logger
// ──────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  ts: string
  level: LogLevel
  ctx: string
  msg: string
  data?: Record<string, unknown>
}

const LOG_DIR = join(app.getPath('userData'), 'logs')

let stream: WriteStream | null = null
let currentDate = ''
let streamReady = false

function getDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ensureStream(): void {
  const today = getDate()
  if (stream && currentDate === today && streamReady) return

  // Close previous stream
  if (stream) {
    try { stream.end() } catch { /* ignore */ }
  }

  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
    const filePath = join(LOG_DIR, `justclaw-${today}.log`)
    stream = createWriteStream(filePath, { flags: 'a' })
    currentDate = today
    streamReady = true

    stream.on('error', () => { streamReady = false })
  } catch {
    stream = null
    streamReady = false
  }
}

function write(level: LogLevel, ctx: string, msg: string, data?: Record<string, unknown>): void {
  ensureStream()
  if (!stream || !streamReady) {
    // Fallback to console if file logging unavailable
    const prefix = `[${level.toUpperCase()}][${ctx}]`
    data ? console.log(prefix, msg, JSON.stringify(data)) : console.log(prefix, msg)
    return
  }

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    ctx,
    msg,
    ...(data ? { data } : {})
  }

  const line = JSON.stringify(entry) + '\n'
  stream.write(line, () => { /* write queued */ })
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export const logger = {
  debug: (ctx: string, msg: string, data?: Record<string, unknown>) => write('debug', ctx, msg, data),
  info: (ctx: string, msg: string, data?: Record<string, unknown>) => write('info', ctx, msg, data),
  warn: (ctx: string, msg: string, data?: Record<string, unknown>) => write('warn', ctx, msg, data),
  error: (ctx: string, msg: string, data?: Record<string, unknown>) => write('error', ctx, msg, data),

  /**
   * Flush and close the log stream.
   */
  close: (): void => {
    if (stream) {
      try { stream.end() } catch { /* ignore */ }
      stream = null
      streamReady = false
    }
  }
}
