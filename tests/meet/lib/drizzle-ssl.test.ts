import { describe, expect, it } from 'vitest'
import { resolveDbSsl } from '@/lib/drizzle'

describe('meet database TLS policy', () => {
  it('verifies the certificate and hostname by default', () => {
    expect(resolveDbSsl({})).toBe('verify-full')
  })

  it('allows only the named local development exceptions', () => {
    expect(resolveDbSsl({ DATABASE_SSL: 'no-verify' })).toBe('require')
    expect(resolveDbSsl({ DATABASE_SSL: 'disable' })).toBe(false)
  })

  it('normalizes case and whitespace', () => {
    expect(resolveDbSsl({ DATABASE_SSL: '  NO-VERIFY  ' })).toBe('require')
    expect(resolveDbSsl({ DATABASE_SSL: ' DISABLE ' })).toBe(false)
  })

  it('fails safely for unknown values', () => {
    expect(resolveDbSsl({ DATABASE_SSL: 'require' })).toBe('verify-full')
    expect(resolveDbSsl({ DATABASE_SSL: 'anything-else' })).toBe('verify-full')
  })
})
