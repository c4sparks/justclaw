import { describe, it, expect } from 'vitest'
import { IPC } from '../src/shared/types'

describe('IPC channel constants', () => {
  it('should have all required channels', () => {
    expect(IPC.APP_VERSION).toBe('app:version')
    expect(IPC.ENV_CHECK).toBe('env:check')
    expect(IPC.GATEWAY_START).toBe('gateway:start')
    expect(IPC.GATEWAY_STOP).toBe('gateway:stop')
    expect(IPC.INSTALL_NODE).toBe('install:node')
    expect(IPC.INSTALL_OPENCLAW).toBe('install:openclaw')
  })

  it('should have no duplicate values', () => {
    const values = Object.values(IPC)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})
