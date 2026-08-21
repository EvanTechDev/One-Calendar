import crypto from 'crypto'
import { describe, it, expect } from 'vitest'
import {
  redirectUriAllowed,
  generateUserCode,
  generateCodeChallenge,
  hashToken,
  hashAuthorizationCode,
  isValidRedirectUri,
  validateRedirectUris,
  parseRequestedScopes,
} from '@/lib/mcp/auth'
import { ALL_SCOPES, McpAuthError } from '@/lib/mcp/types'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

describe('redirectUriAllowed', () => {
  it('returns true for an exact registered uri', () => {
    const registered = ['https://app.example.com/callback']
    expect(
      redirectUriAllowed(registered, 'https://app.example.com/callback'),
    ).toBe(true)
  })

  it('rejects a trailing slash', () => {
    const registered = ['https://app.example.com/callback']
    expect(
      redirectUriAllowed(registered, 'https://app.example.com/callback/'),
    ).toBe(false)
  })

  it('rejects a different scheme', () => {
    const registered = ['https://app.example.com/callback']
    expect(
      redirectUriAllowed(registered, 'http://app.example.com/callback'),
    ).toBe(false)
  })

  it('rejects an extra path', () => {
    const registered = ['https://app.example.com/callback']
    expect(
      redirectUriAllowed(registered, 'https://app.example.com/callback/extra'),
    ).toBe(false)
  })

  it('rejects an unregistered host', () => {
    const registered = ['https://app.example.com/callback']
    expect(
      redirectUriAllowed(registered, 'https://evil.example.com/callback'),
    ).toBe(false)
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

describe('hashAuthorizationCode', () => {
  it('returns 64 lowercase hex characters', () => {
    expect(hashAuthorizationCode(crypto.randomUUID())).toMatch(/^[0-9a-f]{64}$/)
  })

  it('never returns the input, so a DB read is useless', () => {
    const code = crypto.randomUUID()
    expect(hashAuthorizationCode(code)).not.toBe(code)
  })

  it('is deterministic and distinct across inputs', () => {
    const a = crypto.randomUUID()
    const b = crypto.randomUUID()
    expect(hashAuthorizationCode(a)).toBe(hashAuthorizationCode(a))
    expect(hashAuthorizationCode(a)).not.toBe(hashAuthorizationCode(b))
  })

  it('agrees with hashToken for the same input', () => {
    const code = crypto.randomUUID()
    expect(hashAuthorizationCode(code)).toBe(hashToken(code))
  })
})

describe('isValidRedirectUri', () => {
  it('accepts https, loopback http and private-use schemes', () => {
    expect(isValidRedirectUri('https://app.example.com/cb')).toBe(true)
    expect(isValidRedirectUri('http://localhost:3000/cb')).toBe(true)
    expect(isValidRedirectUri('http://127.0.0.1:8080/cb')).toBe(true)
    expect(isValidRedirectUri('myapp://callback')).toBe(true)
  })

  it('rejects non-loopback http', () => {
    expect(isValidRedirectUri('http://evil.example.com/cb')).toBe(false)
  })

  it('rejects script-executing and local schemes', () => {
    expect(isValidRedirectUri('javascript:alert(1)')).toBe(false)
    expect(isValidRedirectUri('data:text/html,x')).toBe(false)
    expect(isValidRedirectUri('file:///etc/passwd')).toBe(false)
  })

  it('rejects a fragment', () => {
    expect(isValidRedirectUri('https://app.example.com/cb#frag')).toBe(false)
  })

  it('rejects relative, empty, malformed and non-string values', () => {
    expect(isValidRedirectUri('/relative/cb')).toBe(false)
    expect(isValidRedirectUri('')).toBe(false)
    expect(isValidRedirectUri('not a url')).toBe(false)
    expect(isValidRedirectUri(123)).toBe(false)
    expect(isValidRedirectUri(null)).toBe(false)
  })

  it('rejects a uri longer than 2048 chars', () => {
    expect(
      isValidRedirectUri(`https://app.example.com/${'a'.repeat(2100)}`),
    ).toBe(false)
  })
})

describe('validateRedirectUris', () => {
  it('returns a valid single-entry list unchanged', () => {
    const uris = ['https://app.example.com/cb']
    expect(validateRedirectUris(uris)).toEqual(uris)
  })

  it('throws McpAuthError(400) for an empty list', () => {
    try {
      validateRedirectUris([])
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(McpAuthError)
      expect((err as McpAuthError).statusCode).toBe(400)
    }
  })

  it('throws for a non-array', () => {
    expect(() => validateRedirectUris('https://a.example.com/cb')).toThrow(
      McpAuthError,
    )
  })

  it('throws for more than 10 entries', () => {
    const uris = Array.from(
      { length: 11 },
      (_v, i) => `https://app.example.com/cb${i}`,
    )
    expect(() => validateRedirectUris(uris)).toThrow(McpAuthError)
  })

  it('throws when one entry is invalid', () => {
    expect(() =>
      validateRedirectUris([
        'https://app.example.com/cb',
        'javascript:alert(1)',
      ]),
    ).toThrow(McpAuthError)
  })
})

describe('parseRequestedScopes', () => {
  it('returns an empty list for undefined', () => {
    expect(parseRequestedScopes(undefined)).toEqual([])
  })

  it('keeps a single supported scope', () => {
    expect(parseRequestedScopes('events:read')).toEqual(['events:read'])
  })

  it('keeps multiple supported scopes', () => {
    expect(parseRequestedScopes('events:read events:write')).toEqual([
      'events:read',
      'events:write',
    ])
  })

  it('drops unknown scopes', () => {
    expect(parseRequestedScopes('events:read admin:all')).toEqual([
      'events:read',
    ])
  })

  it('returns an empty list when everything is unknown', () => {
    expect(parseRequestedScopes('admin:all root:everything')).toEqual([])
  })

  it('collapses duplicates', () => {
    expect(parseRequestedScopes('events:read events:read')).toEqual([
      'events:read',
    ])
  })

  it('round-trips every member of ALL_SCOPES', () => {
    expect(parseRequestedScopes(ALL_SCOPES.join(' '))).toEqual([...ALL_SCOPES])
  })
})
