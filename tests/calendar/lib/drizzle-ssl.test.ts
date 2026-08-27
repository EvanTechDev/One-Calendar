import { describe, expect, it } from 'vitest'
import { resolveDbSsl } from '@/lib/drizzle/client'

describe('calendar database TLS policy', () => {
  const pem = [
    '-----BEGIN CERTIFICATE-----',
    'test-ca-body',
    '-----END CERTIFICATE-----',
  ].join('\n')

  it('requires an encrypted connection by default', () => {
    expect(resolveDbSsl({})).toBe('require')
  })

  it('supports explicit verification and local development exceptions', () => {
    expect(resolveDbSsl({ DATABASE_SSL: 'verify-full' })).toBe('verify-full')
    expect(resolveDbSsl({ DATABASE_SSL: 'require' })).toBe('require')
    expect(resolveDbSsl({ DATABASE_SSL: 'no-verify' })).toBe('require')
    expect(resolveDbSsl({ DATABASE_SSL: 'disable' })).toBe(false)
  })

  it('normalizes case and whitespace', () => {
    expect(resolveDbSsl({ DATABASE_SSL: '  NO-VERIFY  ' })).toBe('require')
    expect(resolveDbSsl({ DATABASE_SSL: ' DISABLE ' })).toBe(false)
  })

  it('uses the deployment-compatible default for unknown values', () => {
    expect(resolveDbSsl({ DATABASE_SSL: 'anything-else' })).toBe('require')
  })

  it('uses an explicit CA without disabling peer verification', () => {
    expect(resolveDbSsl({ DATABASE_SSL_CA: pem })).toEqual({
      ca: pem,
      rejectUnauthorized: true,
    })
    expect(
      resolveDbSsl({ DATABASE_SSL_CA: pem.replace(/\n/g, '\\n') }),
    ).toEqual({
      ca: pem,
      rejectUnauthorized: true,
    })
  })

  it('rejects malformed CA configuration', () => {
    expect(() =>
      resolveDbSsl({ DATABASE_SSL_CA: 'not a certificate' }),
    ).toThrow(/PEM certificate/)
  })
})
