import { describe, expect, it } from 'vitest'
import { SESSION_PREFIX, sessionKey } from '@/lib/cache/keys'

describe('sessionKey', () => {
  it('returns a 64-char hex digest and never embeds the raw token', () => {
    const token = `raw-session-token-${Date.now()}`
    const key = sessionKey(token)
    expect(key).toMatch(new RegExp(`^${SESSION_PREFIX}[0-9a-f]{64}$`))
    expect(key).not.toContain(token)
  })

  it('is deterministic per token and distinct across tokens', () => {
    const a = sessionKey('token-a')
    const b = sessionKey('token-b')
    expect(sessionKey('token-a')).toBe(a)
    expect(sessionKey('token-b')).toBe(b)
    expect(a).not.toBe(b)
  })

  it('keeps the SESSION_PREFIX so old cache namespaces still apply', () => {
    expect(SESSION_PREFIX).toBe('session:token:')
    expect(sessionKey('token-a').startsWith(SESSION_PREFIX)).toBe(true)
  })
})