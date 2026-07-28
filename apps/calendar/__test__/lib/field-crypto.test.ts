import { describe, it, expect, beforeAll } from 'vitest'

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
})
