import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const CURRENT_VERSION = 1

interface Envelope {
  v?: number
  ct: string
  iv: string
  tag: string
}

export class FieldDecryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FieldDecryptionError'
  }
}

const SALT = process.env.SALT

function getSalt(): string {
  if (!SALT || SALT.length < 16) {
    throw new Error(
      'SALT environment variable is missing or shorter than 16 characters',
    )
  }
  return SALT
}

function deriveKey(salt: string, rowId: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(salt, 'utf8'),
      Buffer.from(rowId, 'utf8'),
      'field-encryption',
      32,
    ),
  )
}

/**
 * Recognises our ciphertext envelope without attempting decryption.
 *
 * This is what separates "wrong key / corrupt data" (an error worth shouting
 * about) from "this column holds legacy plaintext written before field
 * encryption existed" (pass through unchanged).
 */
export function looksLikeEnvelope(value: string): boolean {
  if (!value.startsWith('{')) return false
  try {
    const parsed = JSON.parse(value) as Partial<Envelope>
    return (
      typeof parsed.ct === 'string' &&
      typeof parsed.iv === 'string' &&
      typeof parsed.tag === 'string'
    )
  } catch {
    return false
  }
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
    v: CURRENT_VERSION,
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
    const parsed = JSON.parse(encrypted) as Envelope
    // An absent `v` means a row written before versioning existed, i.e. v1.
    const version = parsed.v ?? 1
    if (version !== CURRENT_VERSION) {
      throw new FieldDecryptionError(
        `Unsupported field encryption version: ${version}`,
      )
    }
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

/**
 * Decrypts a field, distinguishing the three cases the old lenient version
 * collapsed into `null`:
 *
 *  - not our envelope  → returned unchanged (legacy plaintext row)
 *  - our envelope, decrypts → plaintext
 *  - our envelope, fails    → throws FieldDecryptionError
 *
 * The third case used to return `null`, and callers wrote `?? storedValue`,
 * which surfaced raw ciphertext to users and re-encrypted it on the next save —
 * silently destroying the original plaintext. Failing loudly is strictly safer:
 * a 500 is recoverable, corrupted data is not.
 */
export function decryptFieldStrict(
  rowId: string,
  stored: string | null | undefined,
): string | null {
  if (stored === null || stored === undefined) return null
  if (!looksLikeEnvelope(stored)) return stored

  const plaintext = decryptField(rowId, stored)
  if (plaintext === null) {
    throw new FieldDecryptionError(
      `Failed to decrypt field for row ${rowId}: wrong SALT or corrupt data`,
    )
  }
  return plaintext
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
