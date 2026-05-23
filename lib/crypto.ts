export type EncryptedPayload = {
  ciphertext: string
  iv: string
}

type KeyCacheMap = Map<string, Promise<CryptoKey>>
const MAX_CACHE_ENTRIES = 128

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

const passwordBaseKeyCache: KeyCacheMap = new Map()
const derivedKeyCache: KeyCacheMap = new Map()

function setWithLimit(
  cache: KeyCacheMap,
  key: string,
  value: Promise<CryptoKey>,
) {
  if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(key, value)
}

export function clearCryptoKeyCaches() {
  passwordBaseKeyCache.clear()
  derivedKeyCache.clear()
}

async function getPasswordBaseKey(
  password: string,
  cache = passwordBaseKeyCache,
) {
  const cached = cache.get(password)
  if (cached) return cached

  const baseKey = crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  setWithLimit(cache, password, baseKey)
  return baseKey
}

export async function deriveCryptoKey(
  password: string,
  salt: Uint8Array,
  cache = derivedKeyCache,
) {
  const saltArray = new Uint8Array(salt)
  const cacheKey = `${password}:${b64(saltArray)}`
  const cached = cache.get(cacheKey)
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

  setWithLimit(cache, cacheKey, derivedKey)
  return derivedKey
}

function parseCiphertext(ciphertext: string): { salt: string; ct: string } {
  const parsed = JSON.parse(ciphertext)
  if (typeof parsed?.salt !== 'string' || typeof parsed?.ct !== 'string') {
    throw new Error('Invalid encrypted payload format')
  }
  return parsed
}

export async function decryptWithDerivedKey(
  password: string,
  ciphertext: string,
  iv: string,
  cache?: KeyCacheMap,
) {
  const { salt, ct } = parseCiphertext(ciphertext)
  const key = await deriveCryptoKey(password, ub64(salt), cache)
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ub64(iv) },
    key,
    ub64(ct),
  )
  return new TextDecoder().decode(pt)
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
  return decryptWithDerivedKey(password, ciphertext, iv)
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== 'object') return false
  return 'ciphertext' in value && 'iv' in value
}

const BACKUP_CHUNK_SIZE = 256 * 1024

type ChunkedEncryptedPayload = {
  v: 2
  chunkSize: number
  chunks: EncryptedPayload[]
}

export async function encryptLargePayload(password: string, text: string) {
  if (text.length <= BACKUP_CHUNK_SIZE) {
    return encryptPayload(password, text)
  }

  const chunks: EncryptedPayload[] = []
  for (let i = 0; i < text.length; i += BACKUP_CHUNK_SIZE) {
    const chunk = text.slice(i, i + BACKUP_CHUNK_SIZE)
    chunks.push(await encryptPayload(password, chunk))
  }

  return {
    ciphertext: JSON.stringify({
      v: 2,
      chunkSize: BACKUP_CHUNK_SIZE,
      chunks,
    } satisfies ChunkedEncryptedPayload),
    iv: 'chunked-v2',
  }
}

export async function decryptLargePayload(
  password: string,
  ciphertext: string,
  iv: string,
) {
  if (iv !== 'chunked-v2') {
    return decryptPayload(password, ciphertext, iv)
  }

  const parsed = JSON.parse(ciphertext) as ChunkedEncryptedPayload
  if (!Array.isArray(parsed?.chunks)) {
    throw new Error('Invalid chunked encrypted payload format')
  }

  const plainChunks = await Promise.all(
    parsed.chunks.map((chunk) =>
      decryptPayload(password, chunk.ciphertext, chunk.iv),
    ),
  )
  return plainChunks.join('')
}
