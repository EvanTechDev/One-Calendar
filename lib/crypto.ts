export type EncryptedPayload = {
  ciphertext: string
  iv: string
}

function b64(u: Uint8Array) {
  return btoa(String.fromCharCode(...u))
}

function ub64(s: string) {
  return new Uint8Array(
    atob(s)
      .split('')
      .map((c) => c.charCodeAt(0)),
  )
}

const passwordBaseKeyCache = new Map<string, Promise<CryptoKey>>()
const derivedKeyCache = new Map<string, Promise<CryptoKey>>()

async function getPasswordBaseKey(password: string) {
  const cached = passwordBaseKeyCache.get(password)
  if (cached) return cached

  const baseKey = crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  passwordBaseKeyCache.set(password, baseKey)
  return baseKey
}

export async function deriveCryptoKey(password: string, salt: Uint8Array) {
  const saltArray = new Uint8Array(salt)
  const cacheKey = `${password}:${b64(saltArray)}`
  const cached = derivedKeyCache.get(cacheKey)
  if (cached) return cached

  const baseKey = await getPasswordBaseKey(password)
  const derivedKey = crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltArray,
      iterations: 250000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )

  derivedKeyCache.set(cacheKey, derivedKey)
  return derivedKey
}

export async function encryptPayload(
  password: string,
  text: string,
): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveCryptoKey(password, salt)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text),
  )
  return {
    ciphertext: JSON.stringify({
      v: 1,
      salt: b64(salt),
      ct: b64(new Uint8Array(ct)),
    }),
    iv: b64(iv),
  }
}

export async function decryptPayload(
  password: string,
  ciphertext: string,
  iv: string,
) {
  const d = JSON.parse(ciphertext)
  const key = await deriveCryptoKey(password, ub64(d.salt))
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ub64(iv) },
    key,
    ub64(d.ct),
  )
  return new TextDecoder().decode(pt)
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== 'object') return false
  return 'ciphertext' in value && 'iv' in value
}
