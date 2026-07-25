import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getSalt(): string {
  const salt = process.env.SALT
  if (!salt) throw new Error('Missing SALT environment variable')
  return salt
}

function deriveKey(salt: string, rowId: string): Buffer {
  return crypto.hkdfSync(
    'sha256',
    Buffer.from(salt, 'utf8'),
    Buffer.from(rowId, 'utf8'),
    'field-encryption',
    32,
  )
}

export function encryptField(
  rowId: string,
  plaintext: string | null | undefined,
): string | null {
  if (plaintext === null || plaintext === undefined) return null
  const salt = getSalt()
  const key = deriveKey(salt, rowId)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return JSON.stringify({
    ct: encrypted,
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
  })
}

export function decryptField(
  rowId: string,
  encrypted: string | null | undefined,
): string | null {
  if (encrypted === null || encrypted === undefined) return null
  try {
    const salt = getSalt()
    const key = deriveKey(salt, rowId)
    const parsed = JSON.parse(encrypted)
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(parsed.iv, 'hex'),
    )
    decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'))
    let decrypted = decipher.update(parsed.ct, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return null
  }
}

export function encryptJsonField<T>(
  rowId: string,
  value: T | null | undefined,
): string | null {
  if (value === null || value === undefined) return null
  return encryptField(rowId, JSON.stringify(value))
}

export function decryptJsonField<T>(
  rowId: string,
  encrypted: string | null | undefined,
): T | null {
  const decrypted = decryptField(rowId, encrypted)
  if (decrypted === null || decrypted === undefined) return null
  try {
    return JSON.parse(decrypted) as T
  } catch {
    return null
  }
}
