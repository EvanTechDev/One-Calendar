import { describe, it, expect } from 'vitest'
import { redactLog, redactLogValue } from '@/lib/redact'

describe('redactLogValue', () => {
  it('masks strings under sensitive keys', () => {
    expect(redactLogValue('abc', 'token')).toBe('[REDACTED]')
    expect(redactLogValue('Bearer x', 'authorization')).toBe('[REDACTED]')
    expect(redactLogValue('k', 'apiKey')).toBe('[REDACTED]')
    expect(redactLogValue('k', 'api_key')).toBe('[REDACTED]')
    expect(redactLogValue('sw0rdfish', 'password')).toBe('[REDACTED]')
    expect(redactLogValue('v', 'secret')).toBe('[REDACTED]')
    expect(redactLogValue('abc', 'cookie')).toBe('[REDACTED]')
  })

  it('is case-insensitive on sensitive keys', () => {
    expect(redactLogValue('abc', 'Authorization')).toBe('[REDACTED]')
    expect(redactLogValue('abc', 'TOKEN')).toBe('[REDACTED]')
  })

  it('masks emails', () => {
    expect(redactLogValue('user@example.com', 'email')).toBe(
      'u\u2022\u2022\u2022@example.com',
    )
    expect(redactLogValue('a@b.co')).toBe('a\u2022\u2022\u2022@b.co')
  })

  it('passes plain strings through unchanged', () => {
    expect(redactLogValue('hello')).toBe('hello')
    expect(redactLogValue('no-at-sign')).toBe('no-at-sign')
    expect(redactLogValue('not-an-email@')).toBe('not-an-email@')
  })

  it('passes non-string values through unchanged', () => {
    expect(redactLogValue(42)).toBe(42)
    expect(redactLogValue(true)).toBe(true)
    expect(redactLogValue(null)).toBeNull()
    expect(redactLogValue(undefined)).toBeUndefined()
  })

  it('recurses into arrays and nested objects', () => {
    const value = {
      headers: { authorization: 'Bearer x', 'x-forwarded-for': '1.2.3.4' },
      email: 'a@b.co',
      ok: true,
      list: [{ token: 'abc' }, 'plain'],
    }
    expect(redactLogValue(value)).toEqual({
      headers: { authorization: '[REDACTED]', 'x-forwarded-for': '1.2.3.4' },
      email: 'a\u2022\u2022\u2022@b.co',
      ok: true,
      list: [{ token: '[REDACTED]' }, 'plain'],
    })
  })
})

describe('redactLog', () => {
  it('redacts a deep mixed structure and stays structurally valid', () => {
    const ctx = {
      user: { id: 'u1', email: 'user@example.com' },
      request: {
        url: '/api/import',
        headers: { cookie: 'session=abc', authorization: 'Bearer tok' },
      },
      body: {
        count: 3,
        items: ['one', 'two', { apiKey: 'k', price: 1.5 }],
      },
    }
    const result = redactLog(ctx) as Record<string, unknown>
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
    expect((result.request as Record<string, unknown>).headers).toEqual({
      cookie: '[REDACTED]',
      authorization: '[REDACTED]',
    })
    expect((result.user as Record<string, unknown>).email).toBe(
      'u\u2022\u2022\u2022@example.com',
    )
    expect(
      (
        (
          (result.body as Record<string, unknown>).items as unknown[]
        )[2] as Record<string, unknown>
      ).apiKey,
    ).toBe('[REDACTED]')
    expect((result.body as Record<string, unknown>).count).toBe(3)
  })

  it('leaves non-sensitive log context untouched', () => {
    expect(redactLog({ status: 200, path: '/api/health' })).toEqual({
      status: 200,
      path: '/api/health',
    })
  })
})
