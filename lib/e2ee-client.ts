export type CloudKeyRecord = {
  wrappedDataKey: string
  keyVersion: number
  algorithm: "AES-GCM-256"
  wrappedBy: "recovery-key"
  createdAt?: string
}

export type DeviceTrustRecord = {
  id: "device-trust"
  wrappedMasterKey: string
  keyVersion: number
  createdAt: string
}

export type BackupPayload = {
  v: number
  storage: Record<string, string>
}

const DB_NAME = "one-calendar-e2ee"
const DB_VERSION = 1
const STORE_NAME = "keys"
const TRUST_RECORD_ID = "device-trust"

function toB64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

function fromB64(value: string) {
  return new Uint8Array(atob(value).split("").map((char) => char.charCodeAt(0)))
}

function normalizeRecoveryKey(value: string) {
  return value.replace(/\s|-/g, "")
}

function toRecoveryKeyDisplay(bytes: Uint8Array) {
  const base = toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
  return base.match(/.{1,4}/g)?.join("-") ?? base
}

function fromRecoveryKeyDisplay(value: string) {
  const normalized = normalizeRecoveryKey(value)
  const b64 = normalized.replace(/-/g, "+").replace(/_/g, "/")
  const padLen = (4 - (b64.length % 4)) % 4
  return fromB64(`${b64}${"=".repeat(padLen)}`)
}

async function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"))
  })
}

async function getTrustRecord() {
  const db = await openDb()
  return new Promise<DeviceTrustRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(TRUST_RECORD_ID)
    req.onsuccess = () => resolve((req.result as DeviceTrustRecord | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function putTrustRecord(record: DeviceTrustRecord) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function importRecoveryKey(recoveryKey: string) {
  const raw = fromRecoveryKeyDisplay(recoveryKey)
  if (raw.byteLength !== 32) {
    throw new Error("Recovery key must be 32 bytes")
  }
  return crypto.subtle.importKey("raw", raw, "AES-KW", false, ["wrapKey", "unwrapKey"])
}


export async function createInitialE2EEState() {
  const recoveryRaw = crypto.getRandomValues(new Uint8Array(32))
  const recoveryKey = toRecoveryKeyDisplay(recoveryRaw)
  const masterKey = await crypto.subtle.importKey("raw", recoveryRaw, "AES-KW", true, ["wrapKey", "unwrapKey"])
  const dataKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
  const deviceKey = await crypto.subtle.generateKey({ name: "AES-KW", length: 256 }, false, ["wrapKey", "unwrapKey"])

  const wrappedDataKey = await crypto.subtle.wrapKey("raw", dataKey, masterKey, "AES-KW")
  const wrappedMasterKey = await crypto.subtle.wrapKey("raw", masterKey, deviceKey, "AES-KW")

  await putTrustRecord({
    id: TRUST_RECORD_ID,
    wrappedMasterKey: toB64(new Uint8Array(wrappedMasterKey)),
    keyVersion: 1,
    createdAt: new Date().toISOString(),
  })

  return {
    recoveryKey,
    cloudRecord: {
      wrappedDataKey: toB64(new Uint8Array(wrappedDataKey)),
      keyVersion: 1,
      algorithm: "AES-GCM-256" as const,
      wrappedBy: "recovery-key" as const,
      createdAt: new Date().toISOString(),
    },
    dataKey,
    deviceKey,
  }
}

export async function hasTrustedDeviceRecord() {
  try {
    const record = await getTrustRecord()
    return Boolean(record?.wrappedMasterKey)
  } catch {
    return false
  }
}

export async function trustDeviceWithRecoveryKey(recoveryKey: string, keyVersion: number) {
  const recoveryCryptoKey = await importRecoveryKey(recoveryKey)
  const deviceKey = await crypto.subtle.generateKey({ name: "AES-KW", length: 256 }, false, ["wrapKey", "unwrapKey"])
  const wrappedMasterKey = await crypto.subtle.wrapKey("raw", recoveryCryptoKey, deviceKey, "AES-KW")

  await putTrustRecord({
    id: TRUST_RECORD_ID,
    wrappedMasterKey: toB64(new Uint8Array(wrappedMasterKey)),
    keyVersion,
    createdAt: new Date().toISOString(),
  })

  return deviceKey
}

export async function unlockDataKeyWithRecoveryKey(recoveryKey: string, cloud: CloudKeyRecord) {
  const recoveryCryptoKey = await importRecoveryKey(recoveryKey)
  const wrappedDataKeyBytes = fromB64(cloud.wrappedDataKey)

  const dataKey = await crypto.subtle.unwrapKey(
    "raw",
    wrappedDataKeyBytes,
    recoveryCryptoKey,
    "AES-KW",
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )

  await trustDeviceWithRecoveryKey(recoveryKey, cloud.keyVersion)
  return dataKey
}

export async function rotateRecoveryKey(oldRecoveryKey: string, cloud: CloudKeyRecord) {
  const oldMaster = await importRecoveryKey(oldRecoveryKey)
  const wrappedDataKeyBytes = fromB64(cloud.wrappedDataKey)

  const dataKey = await crypto.subtle.unwrapKey(
    "raw",
    wrappedDataKeyBytes,
    oldMaster,
    "AES-KW",
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  )

  const nextRecoveryRaw = crypto.getRandomValues(new Uint8Array(32))
  const nextRecoveryDisplay = toRecoveryKeyDisplay(nextRecoveryRaw)
  const nextMasterKey = await crypto.subtle.importKey("raw", nextRecoveryRaw, "AES-KW", true, ["wrapKey", "unwrapKey"])

  const rewrappedDataKey = await crypto.subtle.wrapKey("raw", dataKey, nextMasterKey, "AES-KW")
  await trustDeviceWithRecoveryKey(nextRecoveryDisplay, cloud.keyVersion + 1)

  return {
    recoveryKey: nextRecoveryDisplay,
    cloudRecord: {
      wrappedDataKey: toB64(new Uint8Array(rewrappedDataKey)),
      keyVersion: cloud.keyVersion + 1,
      algorithm: "AES-GCM-256" as const,
      wrappedBy: "recovery-key" as const,
      createdAt: new Date().toISOString(),
    },
    dataKey,
  }
}

export async function encryptBackupWithDataKey(dataKey: CryptoKey, payload: BackupPayload) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify(payload))
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, dataKey, plain)
  return {
    ciphertext: toB64(new Uint8Array(encrypted)),
    iv: toB64(iv),
  }
}

export async function decryptBackupWithDataKey(dataKey: CryptoKey, ciphertext: string, iv: string) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) },
    dataKey,
    fromB64(ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(decrypted)) as BackupPayload
}

export async function clearDeviceTrust() {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).delete(TRUST_RECORD_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
