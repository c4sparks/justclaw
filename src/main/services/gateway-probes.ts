import http from 'http'
import { GATEWAY } from '../config'

const PROBE_TIMEOUT = 3000

/**
 * Probe the OpenClaw gateway HTTP endpoint to check if it's alive.
 * Returns true if the port responds (any HTTP response counts as alive).
 */
export function probeAlive(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(GATEWAY.healthUrl, (res) => {
      res.resume()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(PROBE_TIMEOUT, () => {
      req.destroy()
      resolve(false)
    })
  })
}
