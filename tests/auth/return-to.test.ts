// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createReturnToResolver } from '@zntr/auth/return-to'

/**
 * The return-to guard, shared by both apps.
 *
 * Each app links to the other's sign-in and expects the user back, so both carry
 * a return URL — which makes both an open-redirect surface. The calendar had a
 * hardened resolver and meet had none; sharing it is how meet gets the same
 * protection rather than a second, weaker copy (ADR 0022).
 *
 * The allowlist is deliberately tiny: an app-relative path, or an absolute URL on
 * a sibling origin this deployment actually knows about.
 */
const resolve = createReturnToResolver({
  defaultPath: '/app',
  siblingOrigins: ['https://meettest.xyehr.cn'],
})

describe('createReturnToResolver', () => {
  it('falls back with no request', () => {
    expect(resolve(null)).toBe('/app')
    expect(resolve(undefined)).toBe('/app')
    expect(resolve('')).toBe('/app')
  })

  it('allows an app-relative path', () => {
    expect(resolve('/app/settings')).toBe('/app/settings')
  })

  it('rejects a protocol-relative URL', () => {
    // Browsers treat //evil.com as absolute, so it looks relative and is not.
    expect(resolve('//evil.com')).toBe('/app')
    expect(resolve('//evil.com/path')).toBe('/app')
  })

  it('rejects a backslash variant', () => {
    // Some browsers normalise /\evil.com to //evil.com.
    expect(resolve('/\\evil.com')).toBe('/app')
  })

  it('allows an absolute URL on a known sibling origin', () => {
    expect(resolve('https://meettest.xyehr.cn/dashboard')).toBe(
      'https://meettest.xyehr.cn/dashboard',
    )
  })

  it('rejects any other origin', () => {
    expect(resolve('https://evil.com/')).toBe('/app')
    // Including one that merely starts with an allowed origin.
    expect(resolve('https://meettest.xyehr.cn.evil.com/')).toBe('/app')
  })

  it('rejects a non-http scheme that parses fine', () => {
    // `javascript:` and `data:` are valid URLs and must never be navigated to.
    expect(resolve('javascript:alert(1)')).toBe('/app')
    expect(resolve('data:text/html,<script>alert(1)</script>')).toBe('/app')
  })

  it('rejects an unparseable value', () => {
    expect(resolve('http://')).toBe('/app')
    expect(resolve('not a url')).toBe('/app')
  })

  it('ignores a sibling origin that is not a valid URL', () => {
    // A misconfigured env var must not widen the allowlist to everything.
    const loose = createReturnToResolver({
      defaultPath: '/',
      siblingOrigins: ['not-a-url', ''],
    })
    expect(loose('https://evil.com/')).toBe('/')
  })

  it('accepts a per-call fallback', () => {
    expect(resolve('https://evil.com/', '/dashboard')).toBe('/dashboard')
  })

  it('compares origins, not string prefixes', () => {
    // A path on the sibling is fine; a different port is a different origin.
    expect(resolve('https://meettest.xyehr.cn:8443/x')).toBe('/app')
  })
})

describe('a lazily-read allowlist', () => {
  it('reads the origins on each call, not once at construction', () => {
    // The values come from NEXT_PUBLIC_* vars, inlined at build time, so they
    // cannot change at runtime — but a module evaluated BEFORE the environment is
    // populated would capture an empty allowlist and then reject every sibling URL
    // for the life of the process. Silently: the redirect goes to the default,
    // which is indistinguishable from a user who asked for nothing.
    let origin: string | undefined
    const lazy = createReturnToResolver({
      defaultPath: '/app',
      siblingOrigins: () => [origin],
    })

    expect(lazy('https://meettest.xyehr.cn/x')).toBe('/app')
    origin = 'https://meettest.xyehr.cn'
    expect(lazy('https://meettest.xyehr.cn/x')).toBe(
      'https://meettest.xyehr.cn/x',
    )
  })

  it('still accepts a plain array', () => {
    const eager = createReturnToResolver({
      defaultPath: '/app',
      siblingOrigins: ['https://meettest.xyehr.cn'],
    })
    expect(eager('https://meettest.xyehr.cn/x')).toBe(
      'https://meettest.xyehr.cn/x',
    )
  })
})
