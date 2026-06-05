import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getBackupSalt() {
  const salt = process.env.BACKUP_SALT
  if (!salt) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('BACKUP_SALT is required in production')
    }
    return 'development-backup-salt-change-me'
  }
  return salt
}

function key(scope: string) {
  return crypto
    .createHash('sha256')
    .update(getBackupSalt(), 'utf8')
    .update(':')
    .update(scope, 'utf8')
    .digest()
}

export function encryptServerJson(value: unknown, scope = 'calendar') {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key(scope), iv)
  const plaintext = JSON.stringify(value)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  return {
    encryptedData: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptServerJson<T = unknown>(
  encryptedData: string,
  iv: string,
  authTag: string,
  scope = 'calendar',
): T {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key(scope),
    Buffer.from(iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, 'base64')),
    decipher.final(),
  ]).toString('utf8')
  return JSON.parse(decrypted) as T
}

export function encryptSharePassword(password: string, shareId: string) {
  return encryptServerJson({ password }, `share-password:${shareId}`)
}

export function decryptSharePassword(
  encryptedData: string,
  iv: string,
  authTag: string,
  shareId: string,
) {
  return decryptServerJson<{ password: string }>(
    encryptedData,
    iv,
    authTag,
    `share-password:${shareId}`,
  ).password
}
