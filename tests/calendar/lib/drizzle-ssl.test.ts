import { describe, expect, it } from 'vitest'
import { resolveDbSsl } from '@/lib/drizzle/client'

describe('resolveDbSsl', () => {
  it('verifies the certificate by default', () => {
    expect(resolveDbSsl({})).toBe('verify-full')
  })

  it('maps no-verify to the encrypt-only mode', () => {
    expect(resolveDbSsl({ DATABASE_SSL: 'no-verify' })).toBe('require')
  })

  it('maps disable to no TLS at all', () => {
    expect(resolveDbSsl({ DATABASE_SSL: 'disable' })).toBe(false)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(resolveDbSsl({ DATABASE_SSL: ' NO-VERIFY ' })).toBe('require')
  })

  it('fails safe on an unrecognised value', () => {
    expect(resolveDbSsl({ DATABASE_SSL: 'yes' })).toBe('verify-full')
  })
})
