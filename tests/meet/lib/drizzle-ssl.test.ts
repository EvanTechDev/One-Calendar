import { describe, expect, it } from 'vitest'
import { resolveDbSsl, stripSslParams } from '@/lib/drizzle'

describe('meet database TLS policy', () => {
  const pem = [
    '-----BEGIN CERTIFICATE-----',
    'test-ca-body',
    '-----END CERTIFICATE-----',
  ].join('\n')

  it('requires an encrypted connection by default', () => {
    expect(resolveDbSsl({})).toEqual({ rejectUnauthorized: false })
  })

  it('supports explicit verification and local development exceptions', () => {
    expect(resolveDbSsl({ DATABASE_SSL: 'verify-full' })).toEqual({
      rejectUnauthorized: true,
    })
    expect(resolveDbSsl({ DATABASE_SSL: 'require' })).toEqual({
      rejectUnauthorized: false,
    })
    expect(resolveDbSsl({ DATABASE_SSL: 'no-verify' })).toEqual({
      rejectUnauthorized: false,
    })
    expect(resolveDbSsl({ DATABASE_SSL: 'disable' })).toBe(false)
  })

  it('normalizes case and whitespace', () => {
    expect(resolveDbSsl({ DATABASE_SSL: '  NO-VERIFY  ' })).toEqual({
      rejectUnauthorized: false,
    })
    expect(resolveDbSsl({ DATABASE_SSL: ' DISABLE ' })).toBe(false)
  })

  it('uses the deployment-compatible default for unknown values', () => {
    expect(resolveDbSsl({ DATABASE_SSL: 'anything-else' })).toEqual({
      rejectUnauthorized: false,
    })
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

  it('leaves TLS to DATABASE_SSL by dropping URL ssl parameters', () => {
    expect(
      stripSslParams(
        'postgres://u:p@db.example:5432/app?sslmode=require&application_name=x',
      ),
    ).toBe('postgres://u:p@db.example:5432/app?application_name=x')
    expect(stripSslParams('postgres://u:p@db.example/app')).toBe(
      'postgres://u:p@db.example/app',
    )
  })
})
