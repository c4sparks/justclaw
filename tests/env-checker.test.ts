import { describe, it, expect } from 'vitest'

// Replicate the env-checker's semver logic for testing
function semverGte(v: string, min: string): boolean {
  const [a1, a2, a3] = v.split('.').map(Number)
  const [b1, b2, b3] = min.split('.').map(Number)
  if (a1 !== b1) return a1 > b1
  if (a2 !== b2) return a2 > b2
  return a3 >= b3
}

function parseVersion(raw: string): string | null {
  const m = raw.match(/v?(\d+\.\d+\.\d+)/)
  return m ? m[1] : null
}

describe('semverGte', () => {
  it('should accept equal versions', () => {
    expect(semverGte('22.16.0', '22.16.0')).toBe(true)
  })

  it('should accept newer versions', () => {
    expect(semverGte('22.17.0', '22.16.0')).toBe(true)
    expect(semverGte('23.0.0', '22.16.0')).toBe(true)
    expect(semverGte('22.16.1', '22.16.0')).toBe(true)
  })

  it('should reject older versions', () => {
    expect(semverGte('22.15.0', '22.16.0')).toBe(false)
    expect(semverGte('21.0.0', '22.16.0')).toBe(false)
    expect(semverGte('22.16.0', '22.16.1')).toBe(false)
  })
})

describe('parseVersion', () => {
  it('should parse "v22.16.0"', () => {
    expect(parseVersion('v22.16.0')).toBe('22.16.0')
  })

  it('should parse "22.16.0" without v prefix', () => {
    expect(parseVersion('22.16.0')).toBe('22.16.0')
  })

  it('should return null for invalid strings', () => {
    expect(parseVersion('not-a-version')).toBeNull()
    expect(parseVersion('')).toBeNull()
  })
})
