import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

export class BackupCryptoConfigurationError extends Error {
  constructor() {
    super(
      'Missing BACKUP_SALT. Configure BACKUP_SALT to enable encrypted calendar backups.',
    )
    this.name = 'BackupCryptoConfigurationError'
  }
}

export type ServerEncryptedPayload = {
  encryptedData: string
  iv: string
  authTag: string
}

function getBackupSalt() {
  const salt = process.env.BACKUP_SALT
  if (!salt) throw new BackupCryptoConfigurationError()
  return salt
}

export function validateBackupSalt() {
  return getBackupSalt()
}

export function hashServerSearchText(values: unknown[]) {
  const normalizedValues = values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  const normalizedText = normalizedValues.join(' ')
  const tokens = new Set([
    normalizedText,
    ...normalizedText.split(/\s+/u).filter(Boolean),
  ])

  return Array.from(tokens)
    .map((token) =>
      crypto
        .createHash('sha256')
        .update(getBackupSalt(), 'utf8')
        .update(':search:')
        .update(token, 'utf8')
        .digest('hex'),
    )
    .join(' ')
}

function keyForContext(context: string) {
  return crypto
    .createHash('sha256')
    .update(getBackupSalt(), 'utf8')
    .update(':')
    .update(context, 'utf8')
    .digest()
}

export function encryptServerJson(
  value: unknown,
  context: string,
): ServerEncryptedPayload {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, keyForContext(context), iv)
  const plain = JSON.stringify(value ?? {})
  let encryptedData = cipher.update(plain, 'utf8', 'hex')
  encryptedData += cipher.final('hex')
  return {
    encryptedData,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  }
}

export function decryptServerJson<T>(
  encryptedData: string | null,
  iv: string | null,
  authTag: string | null,
  context: string,
  fallback: T,
): T {
  if (!encryptedData || !iv || !authTag) return fallback
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    keyForContext(context),
    Buffer.from(iv, 'hex'),
  )
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  let plain = decipher.update(encryptedData, 'hex', 'utf8')
  plain += decipher.final('utf8')
  return JSON.parse(plain) as T
}
