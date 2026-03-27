export type EncryptedPayload = {
  ciphertext: string
  iv: string
}

function b64(u: Uint8Array) {
  return btoa(String.fromCharCode(...u))
}

function ub64(s: string) {
  return new Uint8Array(atob(s).split("").map((c) => c.charCodeAt(0)))
}

async function derive(password: string, salt: Uint8Array) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    k,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function encryptPayload(password: string, text: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await derive(password, salt)
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text),
  )
  return {
    ciphertext: JSON.stringify({ v: 1, salt: b64(salt), ct: b64(new Uint8Array(ct)) }),
    iv: b64(iv),
  }
}

export async function decryptPayload(password: string, ciphertext: string, iv: string) {
  const d = JSON.parse(ciphertext)
  const key = await derive(password, ub64(d.salt))
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ub64(iv) },
    key,
    ub64(d.ct),
  )
  return new TextDecoder().decode(pt)
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") return false
  return "ciphertext" in value && "iv" in value
}
