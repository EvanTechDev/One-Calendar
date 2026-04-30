const PBKDF2_ITERATIONS = 300_000
const PBKDF2_HASH = 'SHA-256'
const AES_ALGO = 'AES-GCM'

const INFO_AUTH = 'one-calendar:auth'
const INFO_MASTER = 'one-calendar:master'
const INFO_BACKUP = 'one-calendar:backup'
const INFO_SESSION = 'one-calendar:session'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export type WrappedKeyBlob = {
  blob: string
  iv: string
}

export type EncryptedEventBlob = {
  ciphertext: string
  iv: string
  wrappedDek: string
  dekIv: string
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

export function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

async function deriveAesKey(
  password: string,
  salt: string,
  info: string,
): Promise<CryptoKey> {
  const passKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  const namespacedSalt = new Uint8Array([
    ...base64ToBytes(salt),
    ...textEncoder.encode(`:${info}`),
  ])

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: PBKDF2_HASH,
      iterations: PBKDF2_ITERATIONS,
      salt: namespacedSalt,
    },
    passKey,
    { name: AES_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  )
}

export async function deriveAuthHash(
  password: string,
  authSalt: string,
): Promise<string> {
  const passKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: PBKDF2_HASH,
      iterations: PBKDF2_ITERATIONS,
      salt: new Uint8Array([...base64ToBytes(authSalt), ...textEncoder.encode(`:${INFO_AUTH}`)]),
    },
    passKey,
    256,
  )

  return bytesToBase64(new Uint8Array(bits))
}

export function deriveMasterKey(password: string, keySalt: string): Promise<CryptoKey> {
  return deriveAesKey(password, keySalt, INFO_MASTER)
}

export function deriveBackupKEK(
  password: string,
  backupSalt: string,
): Promise<CryptoKey> {
  return deriveAesKey(password, backupSalt, INFO_BACKUP)
}

export async function deriveKEK(sessionSecret: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(sessionSecret),
    'HKDF',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: textEncoder.encode('one-calendar:session-salt'),
      info: textEncoder.encode(INFO_SESSION),
    },
    base,
    { name: AES_ALGO, length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

export async function wrapMasterKey(
  masterKey: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<WrappedKeyBlob> {
  const iv = randomBytes(12)
  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    masterKey,
    wrappingKey,
    { name: AES_ALGO, iv },
  )

  return { blob: bytesToBase64(new Uint8Array(wrapped)), iv: bytesToBase64(iv) }
}

export async function unwrapMasterKey(
  blob: string,
  iv: string,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    base64ToBytes(blob),
    wrappingKey,
    { name: AES_ALGO, iv: base64ToBytes(iv) },
    { name: AES_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  )
}

export async function wrapMasterKeyForBackup(
  masterKey: CryptoKey,
  password: string,
  backupSalt: string,
) {
  const backupKEK = await deriveBackupKEK(password, backupSalt)
  return wrapMasterKey(masterKey, backupKEK)
}

export async function unwrapMasterKeyFromBackup(
  blob: string,
  iv: string,
  password: string,
  backupSalt: string,
) {
  const backupKEK = await deriveBackupKEK(password, backupSalt)
  return unwrapMasterKey(blob, iv, backupKEK)
}

export async function encryptEvent(payload: unknown, masterKey: CryptoKey) {
  const dek = await crypto.subtle.generateKey(
    { name: AES_ALGO, length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )

  const iv = randomBytes(12)
  const plaintext = textEncoder.encode(JSON.stringify(payload))
  const ciphertext = await crypto.subtle.encrypt({ name: AES_ALGO, iv }, dek, plaintext)

  const dekIv = randomBytes(12)
  const wrappedDek = await crypto.subtle.wrapKey('raw', dek, masterKey, {
    name: AES_ALGO,
    iv: dekIv,
  })

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    wrappedDek: bytesToBase64(new Uint8Array(wrappedDek)),
    dekIv: bytesToBase64(dekIv),
  }
}

export async function decryptEvent<T>(
  encryptedEvent: EncryptedEventBlob,
  masterKey: CryptoKey,
): Promise<T> {
  const dek = await crypto.subtle.unwrapKey(
    'raw',
    base64ToBytes(encryptedEvent.wrappedDek),
    masterKey,
    { name: AES_ALGO, iv: base64ToBytes(encryptedEvent.dekIv) },
    { name: AES_ALGO, length: 256 },
    false,
    ['decrypt'],
  )

  const plaintext = await crypto.subtle.decrypt(
    { name: AES_ALGO, iv: base64ToBytes(encryptedEvent.iv) },
    dek,
    base64ToBytes(encryptedEvent.ciphertext),
  )

  return JSON.parse(textDecoder.decode(plaintext)) as T
}
