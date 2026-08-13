import { describe, it, expect } from 'vitest'
import {
  redirectUriAllowed,
  generateUserCode,
  generateCodeChallenge,
  hashToken,
} from '@/lib/mcp/auth'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

describe('redirectUriAllowed', () => {
  it('returns true for an exact registered uri', () => {
    const registered = ['https://app.example.com/callback']
    expect(redirectUriAllowed(registered, 'https://app.example.com/callback')).toBe(
      true,
    )
  })

  it('rejects a trailing slash', () => {
    const registered = ['https://app.example.com/callback']
    expect(redirectUriAllowed(registered, 'https://app.example.com/callback/')).toBe(
      false,
    )
  })

  it('rejects a different scheme', () => {
    const registered = ['https://app.example.com/callback']
    expect(redirectUriAllowed(registered, 'http://app.example.com/callback')).toBe(
      false,
    )
  })

  it('rejects an extra path', () => {
    const registered = ['https://app.example.com/callback']
    expect(
      redirectUriAllowed(registered, 'https://app.example.com/callback/extra'),
    ).toBe(false)
  })

  it('rejects an unregistered host', () => {
    const registered = ['https://app.example.com/callback']
    expect(redirectUriAllowed(registered, 'https://evil.example.com/callback')).toBe(
      false,
    )
  })

  it('returns false for an empty registered list', () => {
    expect(redirectUriAllowed([], 'https://app.example.com/callback')).toBe(
      false,
    )
  })
})

describe('generateUserCode', () => {
  it('matches the XXXX-XXXX format with the allowed charset', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateUserCode()).toMatch(
        /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
      )
    }
  })

  it('uses only the allowed charset', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateUserCode()
      for (const ch of code.replace('-', '')) {
        expect(CHARS).toContain(ch)
      }
    }
  })

  it('produces no duplicates in 2000 samples', () => {
    const samples = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      samples.add(generateUserCode())
    }
    expect(samples.size).toBe(2000)
  })
})

describe('generateCodeChallenge', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'

  it('is deterministic for S256', () => {
    const a = generateCodeChallenge(verifier, 'S256')
    const b = generateCodeChallenge(verifier, 'S256')
    expect(a).toBe(b)
  })

  it('produces base64url output without padding', () => {
    const challenge = generateCodeChallenge(verifier, 'S256')
    expect(challenge).not.toContain('=')
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('returns the verifier unchanged for an unknown method', () => {
    expect(generateCodeChallenge(verifier, 'plain')).toBe(verifier)
  })
})

describe('hashToken', () => {
  it('returns a 64-char sha256 hex digest', () => {
    expect(hashToken('some-token')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('differs for distinct inputs', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'))
  })
})