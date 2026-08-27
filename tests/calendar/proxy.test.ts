import crypto from 'crypto'
import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import proxy, { getCsp, isCspExemptPath } from '@/proxy'

// The contract under test: Next extracts the nonce from the request CSP header
// with exactly this regex (see get-script-nonce-from-header.js).
const CSP_NONCE_SOURCE_REGEX = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/

function scriptSrc(csp: string): string | undefined {
  return csp
    .split(';')
    .map((s) => s.trim())
    .find((d) => d.startsWith('script-src'))
}

describe('getCsp nonce format', () => {
  it('emits a nonce source Next can parse, for any generated nonce', () => {
    for (let i = 0; i < 50; i++) {
      const nonce = crypto.randomBytes(16).toString('base64')
      const directive = scriptSrc(getCsp(nonce))
      expect(directive).toBeDefined()
      const source = directive!
        .split(/\s+/)
        .find((s) => CSP_NONCE_SOURCE_REGEX.test(s))
      expect(source).toBeDefined()
      expect(source!.match(CSP_NONCE_SOURCE_REGEX)?.[1]).toBe(nonce)
    }
  })

  it('always contains a script-src directive', () => {
    expect(scriptSrc(getCsp('n'))).toBeDefined()
  })
})

describe('isCspExemptPath', () => {
  it('exempts API routes and static assets', () => {
    expect(isCspExemptPath('/api/events')).toBe(true)
    expect(isCspExemptPath('/_next/static/chunk.js')).toBe(true)
    expect(isCspExemptPath('/favicon.ico')).toBe(true)
    expect(isCspExemptPath('/icons/a.png')).toBe(true)
  })

  it('does not exempt HTML routes', () => {
    expect(isCspExemptPath('/')).toBe(false)
    expect(isCspExemptPath('/app')).toBe(false)
    expect(isCspExemptPath('/invite/tok')).toBe(false)
    expect(isCspExemptPath('/privacy')).toBe(false)
    expect(isCspExemptPath('/terms')).toBe(false)
  })
})

describe('CSP policy invariants', () => {
  it('keeps the restrictive directives', () => {
    const csp = getCsp('n')
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("default-src 'self'")
  })
})

describe('authentication redirects', () => {
  it('does not treat a cookie as a validated session on sign-in', () => {
    const request = new NextRequest('https://calendar.example/sign-in', {
      headers: {
        cookie: 'better-auth.session_token=stale-or-unreadable',
      },
    })

    const response = proxy(request)

    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})
