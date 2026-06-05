'use client'

import { useEffect, useRef, useState, type SetStateAction } from 'react'

type EncryptionState = {
  enabled: boolean
  password: string | null
  ready: boolean
}

const ENCRYPTION_STATE: EncryptionState = {
  enabled: false,
  password: null,
  ready: true,
}

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
  if (typeof initialValue === 'string' || initialValue === null) return raw as T
  return initialValue
}

function emitStorageWrite(key: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('local-storage-written', { detail: { key } }),
  )
}

function notifySubscribers() {
  subscribers.forEach((callback) => callback())
}

export function isSensitiveStorageKey(_key: string) {
  return false
}

export function getEncryptionState() {
  return { ...ENCRYPTION_STATE }
}

export function subscribeEncryptionState(callback: () => void) {
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}

export async function setEncryptionPassword(_password: string) {
  ENCRYPTION_STATE.enabled = false
  ENCRYPTION_STATE.password = null
  ENCRYPTION_STATE.ready = true
  notifySubscribers()
}

export function clearEncryptionPassword() {
  ENCRYPTION_STATE.enabled = false
  ENCRYPTION_STATE.password = null
  ENCRYPTION_STATE.ready = true
  inMemoryStorage.clear()
  notifySubscribers()
}

export function resetEncryptionReady() {
  ENCRYPTION_STATE.ready = true
  notifySubscribers()
}

export function markEncryptedSnapshot(key: string, value: string) {
  inMemoryStorage.set(key, value)
}

export function clearEncryptedSnapshots() {
  inMemoryStorage.clear()
}

export function writeInMemoryStorage(key: string, value: string) {
  inMemoryStorage.set(key, value)
}

export function removeInMemoryStorage(key: string) {
  inMemoryStorage.delete(key)
}

export function readInMemoryStorage(key: string) {
  return inMemoryStorage.get(key) ?? null
}

export function clearInMemoryStorage() {
  inMemoryStorage.clear()
}

export async function decryptSnapshots(_password: string) {}

export async function encryptSnapshots(_password: string) {}

export async function persistEncryptedSnapshots() {}

export async function readEncryptedLocalStorage<T>(
  key: string,
  initialValue: T,
): Promise<T> {
  if (typeof window === 'undefined') return initialValue
  try {
    const memoryValue = inMemoryStorage.get(key)
    if (memoryValue !== undefined)
      return coerceStoredValue(memoryValue, initialValue)
    const item = window.localStorage.getItem(key)
    if (!item) return initialValue
    return coerceStoredValue(item, initialValue)
  } catch (error) {
    console.log(error)
    return initialValue
  }
}

export async function writeEncryptedLocalStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    const raw = JSON.stringify(value)
    window.localStorage.setItem(key, raw)
    inMemoryStorage.set(key, raw)
    emitStorageWrite(key)
  } catch (error) {
    console.log(error)
  }
}

async function readLocalStorage<T>(key: string, initialValue: T): Promise<T> {
  return readEncryptedLocalStorage(key, initialValue)
}

async function writeLocalStorage<T>(key: string, value: T) {
  return writeEncryptedLocalStorage(key, value)
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [serializedValue, setSerializedValue] = useState(() =>
    JSON.stringify(initialValue),
  )
  const localWriteVersionRef = useRef(0)

  const updateStoredValue = (value: SetStateAction<T>) => {
    localWriteVersionRef.current += 1
    setStoredValue(value)
  }

  useEffect(() => {
    let cancelled = false
    const writeVersionWhenReadStarted = localWriteVersionRef.current
    readLocalStorage(key, initialValue).then((value) => {
      if (cancelled) return
      if (localWriteVersionRef.current !== writeVersionWhenReadStarted) return
      setStoredValue(value)
      setSerializedValue(JSON.stringify(value))
    })
    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    const handleStorage = (
      event: StorageEvent | CustomEvent<{ key: string }>,
    ) => {
      const changedKey = 'key' in event ? event.key : event.detail?.key
      if (changedKey !== key) return
      void readLocalStorage(key, initialValue).then((value) => {
        setStoredValue(value)
        setSerializedValue(JSON.stringify(value))
      })
    }
    window.addEventListener('storage', handleStorage as EventListener)
    window.addEventListener(
      'local-storage-written',
      handleStorage as EventListener,
    )
    return () => {
      window.removeEventListener('storage', handleStorage as EventListener)
      window.removeEventListener(
        'local-storage-written',
        handleStorage as EventListener,
      )
    }
  }, [key])

  useEffect(() => {
    const nextSerialized = JSON.stringify(storedValue)
    if (nextSerialized === serializedValue) return
    setSerializedValue(nextSerialized)
    void writeLocalStorage(key, storedValue)
  }, [key, serializedValue, storedValue])

  return [storedValue, updateStoredValue] as const
}
