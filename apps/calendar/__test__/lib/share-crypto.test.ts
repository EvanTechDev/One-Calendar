import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function deriveKey(salt: string, shareId: string): Buffer {
  return crypto.hkdfSync(
    'sha256',
    Buffer.from(salt, 'utf8'),
    Buffer.from(shareId, 'utf8'),
    'share-key',
    32,
  )
}

function deriveKeyWithPassword(password: string, shareId: string): Buffer {
  return crypto.scryptSync(password, shareId, 32)
}

function encryptWithKey(
  data: string,
  key: Buffer,
): { encryptedPayload: string } {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return {
    encryptedPayload: JSON.stringify({
      ct: encrypted,
      iv: iv.toString('hex'),
      tag: authTag.toString('hex'),
    }),
  }
}

function decryptWithKey(encryptedPayload: string, key: Buffer): string {
  const parsed = JSON.parse(encryptedPayload)
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(parsed.iv, 'hex'),
  )
  decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'))
  let decrypted = decipher.update(parsed.ct, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

beforeAll(() => {
  process.env.SALT = 'test-salt-value-at-least-16-chars!!'
})

describe('share crypto', () => {
  it('HKDF deriveKey is deterministic and works for encryption', () => {
    const salt = 'test-salt'
    const shareId = 'share-123'
    const keyA = deriveKey(salt, shareId)
    const keyB = deriveKey(salt, shareId)
    expect(keyA).toEqual(keyB)

    const data = JSON.stringify({ msg: 'hello' })
    const { encryptedPayload } = encryptWithKey(data, keyA)
    const decrypted = decryptWithKey(encryptedPayload, keyB)
    expect(decrypted).toBe(data)
  })

  it('different shareId produces different key material', () => {
    const salt = 'test-salt'
    const keyA = deriveKey(salt, 'share-a')
    const keyB = deriveKey(salt, 'share-b')
    const keyALength =
      typeof keyA === 'object' && keyA !== null
        ? (keyA as any).length || (keyA as any).byteLength
        : undefined
    expect(keyALength).toBe(32)
    const keyBLength =
      typeof keyB === 'object' && keyB !== null
        ? (keyB as any).length || (keyB as any).byteLength
        : undefined
    expect(keyBLength).toBe(32)
    expect(Buffer.from(keyA as any).equals(Buffer.from(keyB as any))).toBe(
      false,
    )
  })

  it('scrypt deriveKeyWithPassword produces deterministic key', () => {
    const keyA = deriveKeyWithPassword('mypassword', 'share-123')
    const keyB = deriveKeyWithPassword('mypassword', 'share-123')
    expect(keyA).toEqual(keyB)
  })

  it('different password produces different key', () => {
    const keyA = deriveKeyWithPassword('pass-a', 'share-1')
    const keyB = deriveKeyWithPassword('pass-b', 'share-1')
    expect(Buffer.isBuffer(keyA)).toBe(true)
    expect(Buffer.isBuffer(keyB)).toBe(true)
    expect(keyA.equals(keyB)).toBe(false)
  })

  it('encryptWithKey and decryptWithKey round-trip', () => {
    const key = deriveKey('test-salt', 'share-roundtrip')
    const payload = JSON.stringify({ id: 'evt-1', title: 'Test Event' })

    const { encryptedPayload } = encryptWithKey(payload, key)
    const decrypted = decryptWithKey(encryptedPayload, key)

    expect(decrypted).toBe(payload)
    expect(JSON.parse(decrypted)).toHaveProperty('title', 'Test Event')
  })

  it('decryptWithKey fails with wrong key', () => {
    const data = JSON.stringify({ secret: 'my-secret' })
    const keyA = deriveKey('salt-a', 'share-1')
    const keyB = deriveKey('salt-b', 'share-1')

    const { encryptedPayload } = encryptWithKey(data, keyA)
    expect(() => decryptWithKey(encryptedPayload, keyB)).toThrow()
  })

  it('decryptWithKey fails with corrupted payload', () => {
    const key = deriveKey('test-salt', 'share-corrupt')
    expect(() => decryptWithKey('{bad json}', key)).toThrow()
    expect(() =>
      decryptWithKey(JSON.stringify({ ct: 'bad', iv: 'bad', tag: 'bad' }), key),
    ).toThrow()
  })

  it('encryptWithKey produces different ciphertext each time (random IV)', () => {
    const key = deriveKey('test-salt', 'share-iv-test')
    const data = JSON.stringify({ msg: 'hello' })

    const a = encryptWithKey(data, key)
    const b = encryptWithKey(data, key)
    expect(a.encryptedPayload).not.toBe(b.encryptedPayload)
  })
})
