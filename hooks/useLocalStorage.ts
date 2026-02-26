"use client"

import { useEffect, useState } from "react"
import { decryptPayload, encryptPayload, isEncryptedPayload } from "@/lib/crypto"

type EncryptionState = {
  enabled: boolean
  password: string | null
  ready: boolean
}

type EncryptedSnapshot = {
  value: string | null
  failed: boolean
}

const ENCRYPTION_STATE: EncryptionState = {
  enabled: false,
  password: null,
  ready: false,
}

const encryptedSnapshots = new Map<string, EncryptedSnapshot>()
const inMemoryStorage = new Map<string, string>()
const subscribers = new Set<() => void>()

function tryParse(value: string) {
  try {
    return { ok: true, parsed: JSON.parse(value) }
  } catch {
    return { ok: false, parsed: null }
  }
}

function coerceStoredValue<T>(raw: string, initialValue: T): T {
  const parsed = tryParse(raw)
  if (parsed.ok) return parsed.parsed as T
  if (typeof initialValue === "string" || initialValue === null) {
    return raw as T
  }
  return initialValue
}

function notifySubscribers() {
  subscribers.forEach((callback) => callback())
}

export function getEncryptionState() {
  return { ...ENCRYPTION_STATE }
}

export function subscribeEncryptionState(callback: () => void) {
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}

export async function setEncryptionPassword(password: string) {
  ENCRYPTION_STATE.password = password
  ENCRYPTION_STATE.enabled = true
  ENCRYPTION_STATE.ready = false

  if (password) {
    await decryptSnapshots(password)
  }

  ENCRYPTION_STATE.ready = true
  notifySubscribers()
}

export function clearEncryptionPassword() {
  ENCRYPTION_STATE.password = null
  ENCRYPTION_STATE.enabled = false
  ENCRYPTION_STATE.ready = false
  encryptedSnapshots.clear()
  inMemoryStorage.clear()
  notifySubscribers()
}

export function resetEncryptionReady() {
  ENCRYPTION_STATE.ready = false
  notifySubscribers()
}

export function markEncryptedSnapshot(key: string, value: string) {
  encryptedSnapshots.set(key, { value, failed: false })
}

export function clearEncryptedSnapshots() {
  encryptedSnapshots.clear()
}

export function writeInMemoryStorage(key: string, value: string) {
  inMemoryStorage.set(key, value)
}

export function readInMemoryStorage(key: string) {
  return inMemoryStorage.get(key) ?? null
}

export function clearInMemoryStorage() {
  inMemoryStorage.clear()
}

export async function decryptSnapshots(password: string) {
  const entries = Array.from(encryptedSnapshots.entries())
  if (entries.length === 0) return

  await Promise.all(
    entries.map(async ([key, snapshot]) => {
      if (!snapshot.value) return
      try {
        const parsed = tryParse(snapshot.value)
        if (!parsed.ok || !isEncryptedPayload(parsed.parsed)) return
        const plain = await decryptPayload(password, parsed.parsed.ciphertext, parsed.parsed.iv)
        snapshot.value = plain
        snapshot.failed = false
      } catch {
        snapshot.failed = true
      }
    }),
  )
}

export async function encryptSnapshots(password: string) {
  const entries = Array.from(encryptedSnapshots.entries())
  if (entries.length === 0) return

  await Promise.all(
    entries.map(async ([key, snapshot]) => {
      if (!snapshot.value) return
      try {
        const parsed = tryParse(snapshot.value)
        if (parsed.ok && isEncryptedPayload(parsed.parsed)) {
          snapshot.failed = false
          return
        }
        const encrypted = await encryptPayload(password, snapshot.value)
        snapshot.value = JSON.stringify(encrypted)
        snapshot.failed = false
      } catch {
        snapshot.failed = true
      }
    }),
  )
}

export async function persistEncryptedSnapshots() {
  encryptedSnapshots.forEach((snapshot, key) => {
    if (!snapshot.value) return
    window.localStorage.setItem(key, snapshot.value)
  })
}

export async function readEncryptedLocalStorage<T>(key: string, initialValue: T): Promise<T> {
  if (typeof window === "undefined") {
    return initialValue
  }
  try {
    const inMemoryValue = inMemoryStorage.get(key)
    if (inMemoryValue !== undefined) {
      return coerceStoredValue(inMemoryValue, initialValue)
    }
    const snapshot = encryptedSnapshots.get(key)
    if (snapshot?.value) {
      const parsedSnapshot = tryParse(snapshot.value)
      if (parsedSnapshot.ok && isEncryptedPayload(parsedSnapshot.parsed)) {
        if (!ENCRYPTION_STATE.password) return initialValue
        const plain = await decryptPayload(
          ENCRYPTION_STATE.password,
          parsedSnapshot.parsed.ciphertext,
          parsedSnapshot.parsed.iv,
        )
        encryptedSnapshots.set(key, { value: plain, failed: false })
        return coerceStoredValue<T>(plain, initialValue)
      }
      return coerceStoredValue(snapshot.value, initialValue)
    }
    const item = window.localStorage.getItem(key)
    if (!item) return initialValue
    const parsed = tryParse(item)
    if (parsed.ok && isEncryptedPayload(parsed.parsed)) {
      if (!ENCRYPTION_STATE.password) return initialValue
      const plain = await decryptPayload(
        ENCRYPTION_STATE.password,
        parsed.parsed.ciphertext,
        parsed.parsed.iv,
      )
      encryptedSnapshots.set(key, { value: plain, failed: false })
      return coerceStoredValue<T>(plain, initialValue)
    }
    return coerceStoredValue(item, initialValue)
  } catch (error) {
    console.log(error)
    return initialValue
  }
}

export async function writeEncryptedLocalStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return
  try {
    const raw = JSON.stringify(value)
    if (ENCRYPTION_STATE.enabled && ENCRYPTION_STATE.password) {
      const encrypted = await encryptPayload(ENCRYPTION_STATE.password, raw)
      const payload = JSON.stringify(encrypted)
      window.localStorage.setItem(key, payload)
      encryptedSnapshots.set(key, { value: raw, failed: false })
      return
    }
    window.localStorage.setItem(key, raw)
    encryptedSnapshots.set(key, { value: raw, failed: false })
  } catch (error) {
    console.log(error)
  }
}

async function readLocalStorage<T>(key: string, initialValue: T): Promise<T> {
  if (typeof window === "undefined") {
    return initialValue
  }
  try {
    const inMemoryValue = inMemoryStorage.get(key)
    if (inMemoryValue !== undefined) {
      return coerceStoredValue(inMemoryValue, initialValue)
    }
    const item = window.localStorage.getItem(key)
    if (!item) return initialValue
    const snapshot = encryptedSnapshots.get(key)
    if (snapshot?.value) {
      const parsedSnapshot = tryParse(snapshot.value)
      if (parsedSnapshot.ok && isEncryptedPayload(parsedSnapshot.parsed)) {
        if (!ENCRYPTION_STATE.password) return initialValue
        const plain = await decryptPayload(
          ENCRYPTION_STATE.password,
          parsedSnapshot.parsed.ciphertext,
          parsedSnapshot.parsed.iv,
        )
        snapshot.value = plain
        snapshot.failed = false
        return coerceStoredValue<T>(plain, initialValue)
      }
      return coerceStoredValue(snapshot.value, initialValue)
    }
    const parsed = tryParse(item)
    if (parsed.ok && isEncryptedPayload(parsed.parsed)) {
      encryptedSnapshots.set(key, { value: item, failed: false })
      return initialValue
    }
    return coerceStoredValue(item, initialValue)
  } catch (error) {
    console.log(error)
    return initialValue
  }
}

async function writeLocalStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return
  try {
    const raw = JSON.stringify(value)
    if (ENCRYPTION_STATE.enabled && ENCRYPTION_STATE.password) {
      const encrypted = await encryptPayload(ENCRYPTION_STATE.password, raw)
      const payload = JSON.stringify(encrypted)
      window.localStorage.setItem(key, payload)
      encryptedSnapshots.set(key, { value: raw, failed: false })
      return
    }
    window.localStorage.setItem(key, raw)
    encryptedSnapshots.set(key, { value: raw, failed: false })
  } catch (error) {
    console.log(error)
  }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  useEffect(() => {
    let cancelled = false
    readLocalStorage(key, initialValue).then((value) => {
      if (!cancelled) {
        setStoredValue(value)
      }
    })
    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    const unsubscribe = subscribeEncryptionState(() => {
      const state = getEncryptionState()
      if (state.ready) {
        readLocalStorage(key, initialValue).then((value) => setStoredValue(value))
      }
    })
    return unsubscribe
  }, [key, initialValue])

  useEffect(() => {
    void writeLocalStorage(key, storedValue)
  }, [key, storedValue])

  return [storedValue, setStoredValue] as const
}
