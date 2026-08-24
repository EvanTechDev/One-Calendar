import { describe, expect, it } from 'vitest'
import { sessionTokenFromCookieHeader } from '@/lib/cache/session'

const TOKEN = 'abc123.c2lnbmF0dXJl'

describe('sessionTokenFromCookieHeader', () => {
  it('reads the production __Secure- prefixed cookie name', () => {
    expect(
      sessionTokenFromCookieHeader(
        `__Secure-better-auth.session_token=${TOKEN}; other=1`,
      ),
    ).toBe(TOKEN)
  })

  it('still reads the development cookie name', () => {
    expect(
      sessionTokenFromCookieHeader(`better-auth.session_token=${TOKEN}`),
    ).toBe(TOKEN)
  })

  it('returns null for a missing cookie header', () => {
    expect(sessionTokenFromCookieHeader(null)).toBeNull()
  })

  it('returns null when no session cookie is present', () => {
    expect(sessionTokenFromCookieHeader('foo=1; bar=2')).toBeNull()
  })

  it('returns the token intact when surrounded by other cookies', () => {
    expect(
      sessionTokenFromCookieHeader(
        `foo=1; __Secure-better-auth.session_token=${TOKEN}; bar=2`,
      ),
    ).toBe(TOKEN)
  })
})
