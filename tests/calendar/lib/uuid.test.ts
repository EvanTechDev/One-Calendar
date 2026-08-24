import { afterEach, describe, expect, it, vi } from 'vitest'
import { uuid } from '@/lib/uuid'

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuid', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a valid v4 uuid with native crypto.randomUUID', () => {
    expect(uuid()).toMatch(V4)
  })

  it('falls back to getRandomValues when randomUUID is missing (insecure origin)', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = (i * 17 + 11) % 256
        return arr
      },
    })
    const id = uuid()
    expect(id).toMatch(V4)
    // Deterministic input -> deterministic output, version/variant bits set.
    expect(id).toBe('0b1c2d3e-4f60-4182-93a4-b5c6d7e8f90a')
  })

  it('falls back to Math.random when no crypto exists at all', () => {
    vi.stubGlobal('crypto', undefined)
    expect(uuid()).toMatch(V4)
  })

  it('never throws and produces unique ids', () => {
    vi.stubGlobal('crypto', undefined)
    const ids = new Set(Array.from({ length: 200 }, () => uuid()))
    expect(ids.size).toBe(200)
  })
})
