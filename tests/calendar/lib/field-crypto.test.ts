import { describe, it, expect, beforeAll, vi } from 'vitest'

beforeAll(() => {
  process.env.SALT = 'test-salt-value-at-least-16-chars!!'
})

describe('field-crypto', () => {
  it('encryptField and decryptField round-trip', async () => {
    const { encryptField, decryptField } = await import('@/lib/field-crypto')
    const rowId = 'test-row-123'
    const plaintext = 'Hello, World!'

    const encrypted = encryptField(rowId, plaintext)
    expect(encrypted).toBeTypeOf('string')
    expect(encrypted).not.toBe(plaintext)

    const parsed = JSON.parse(encrypted!)
    expect(parsed).toHaveProperty('ct')
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('tag')

    const decrypted = decryptField(rowId, encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('encryptField returns null for null input', async () => {
    const { encryptField } = await import('@/lib/field-crypto')
    expect(encryptField('row-1', null)).toBeNull()
    expect(encryptField('row-1', undefined)).toBeNull()
  })

  it('decryptField returns null for null input', async () => {
    const { decryptField } = await import('@/lib/field-crypto')
    expect(decryptField('row-1', null)).toBeNull()
    expect(decryptField('row-1', undefined)).toBeNull()
  })

  it('decryptField returns null for corrupted ciphertext', async () => {
    const { decryptField } = await import('@/lib/field-crypto')
    const result = decryptField('row-1', 'invalid-data')
    expect(result).toBeNull()
  })

  it('different rowIds produce different ciphertexts for same plaintext', async () => {
    const { encryptField } = await import('@/lib/field-crypto')
    const a = encryptField('row-a', 'same text')
    const b = encryptField('row-b', 'same text')
    expect(a).not.toBe(b)
  })

  it('encryptJsonField and decryptJsonField round-trip', async () => {
    const { encryptJsonField, decryptJsonField } =
      await import('@/lib/field-crypto')
    const rowId = 'row-json-1'
    const obj = [{ name: 'Alice' }, { name: 'Bob' }]

    const encrypted = encryptJsonField(rowId, obj)
    expect(encrypted).toBeTypeOf('string')

    const decrypted = decryptJsonField<typeof obj>(rowId, encrypted)
    expect(decrypted).toEqual(obj)
  })

  it('decryptField with wrong rowId fails (returns null)', async () => {
    const { encryptField, decryptField } = await import('@/lib/field-crypto')
    const encrypted = encryptField('correct-row', 'secret')
    const result = decryptField('wrong-row', encrypted)
    expect(result).toBeNull()
  })

  it('different SALT produces different ciphertext', async () => {
    const originalSalt = process.env.SALT
    const { encryptField } = await import('@/lib/field-crypto')

    const cipherA = encryptField('row-1', 'hello')

    process.env.SALT = 'different-salt-value-here!!!!!'
    const modB = await import('@/lib/field-crypto')
    const cipherB = modB.encryptField('row-1', 'hello')

    expect(cipherA).not.toBe(cipherB)

    process.env.SALT = originalSalt
  })

  it('still decrypts an old-style envelope with no version marker', async () => {
    const { encryptField, decryptField } = await import('@/lib/field-crypto')
    const rowId = 'row-legacy-envelope'
    const encrypted = encryptField(rowId, 'Legacy secret')!
    const parsed = JSON.parse(encrypted) as Record<string, unknown>
    delete parsed.v
    expect(decryptField(rowId, JSON.stringify(parsed))).toBe('Legacy secret')
  })

  it('new writes carry v: 1', async () => {
    const { encryptField } = await import('@/lib/field-crypto')
    const parsed = JSON.parse(encryptField('row-v', 'x')!)
    expect(parsed.v).toBe(1)
  })

  it('rejects an unsupported future version', async () => {
    const {
      encryptField,
      decryptField,
      decryptFieldStrict,
      FieldDecryptionError,
    } = await import('@/lib/field-crypto')
    const rowId = 'row-future'
    const parsed = JSON.parse(encryptField(rowId, 'x')!)
    parsed.v = 99
    const stored = JSON.stringify(parsed)

    expect(decryptField(rowId, stored)).toBeNull()
    expect(() => decryptFieldStrict(rowId, stored)).toThrow(
      FieldDecryptionError,
    )
  })

  it('looksLikeEnvelope only matches a complete envelope', async () => {
    const { encryptField, looksLikeEnvelope } =
      await import('@/lib/field-crypto')
    expect(looksLikeEnvelope(encryptField('row-le', 'x')!)).toBe(true)
    expect(looksLikeEnvelope('Doctor appt')).toBe(false)
    expect(looksLikeEnvelope('')).toBe(false)
    expect(looksLikeEnvelope('{}')).toBe(false)
    expect(looksLikeEnvelope('{"ct":"x"}')).toBe(false)
    expect(looksLikeEnvelope('not json')).toBe(false)
    expect(looksLikeEnvelope('{ this is my title')).toBe(false)
  })

  it('decryptFieldStrict passes legacy plaintext through unchanged', async () => {
    const { decryptFieldStrict } = await import('@/lib/field-crypto')
    expect(decryptFieldStrict('row1', 'Team standup')).toBe('Team standup')
    expect(decryptFieldStrict('row1', null)).toBeNull()
  })

  it('decryptFieldStrict throws when the salt has been rotated', async () => {
    const originalSalt = process.env.SALT

    vi.resetModules()
    vi.stubEnv('SALT', 'A'.repeat(20))
    const modA = await import('@/lib/field-crypto')
    const encrypted = modA.encryptField('row-rotate', 'secret')!

    vi.resetModules()
    vi.stubEnv('SALT', 'B'.repeat(20))
    const modB = await import('@/lib/field-crypto')

    expect(() => modB.decryptFieldStrict('row-rotate', encrypted)).toThrow(
      modB.FieldDecryptionError,
    )

    vi.unstubAllEnvs()
    vi.resetModules()
    process.env.SALT = originalSalt
  })

  it('encryptField throws when SALT is missing or too short', async () => {
    const originalSalt = process.env.SALT

    vi.resetModules()
    vi.stubEnv('SALT', '')
    const missing = await import('@/lib/field-crypto')
    expect(() => missing.encryptField('row-x', 'v')).toThrow(/SALT/)

    vi.resetModules()
    vi.stubEnv('SALT', 'short')
    const tooShort = await import('@/lib/field-crypto')
    expect(() => tooShort.encryptField('row-x', 'v')).toThrow(/SALT/)

    vi.unstubAllEnvs()
    vi.resetModules()
    process.env.SALT = originalSalt
  })
})
