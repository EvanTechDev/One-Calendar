'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  deriveAuthHash,
  deriveKEK,
  deriveMasterKey,
  randomBytes,
  unwrapMasterKey,
  wrapMasterKey,
  wrapMasterKeyForBackup,
} from '@/lib/crypto'

type AuthPayload = {
  sessionSecret: string
}

type CryptoContextValue = {
  masterKey: CryptoKey | null
  isUnlocked: boolean
  register: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const WRAPPED_MASTER_KEY = 'oc:wrapped-master-key'
const WRAPPED_MASTER_KEY_IV = 'oc:wrapped-master-key-iv'

const CryptoContext = createContext<CryptoContextValue | null>(null)

export function CryptoProvider({ children }: { children: React.ReactNode }) {
  const masterKeyRef = useRef<CryptoKey | null>(null)
  const [isUnlocked, setIsUnlocked] = useState(false)

  const persistToSession = useCallback(async (masterKey: CryptoKey, sessionSecret: string) => {
    const kek = await deriveKEK(sessionSecret)
    const wrapped = await wrapMasterKey(masterKey, kek)
    sessionStorage.setItem(WRAPPED_MASTER_KEY, wrapped.blob)
    sessionStorage.setItem(WRAPPED_MASTER_KEY_IV, wrapped.iv)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const authSalt = btoa(String.fromCharCode(...randomBytes(16)))
    const keySalt = btoa(String.fromCharCode(...randomBytes(16)))
    const backupSalt = btoa(String.fromCharCode(...randomBytes(16)))

    const [authHash, masterKey] = await Promise.all([
      deriveAuthHash(password, authSalt),
      deriveMasterKey(password, keySalt),
    ])

    const wrappedMasterKey = await wrapMasterKeyForBackup(masterKey, password, backupSalt)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        authSalt,
        keySalt,
        backupSalt,
        authHash,
        wrappedMasterKey: wrappedMasterKey.blob,
        wrappedMasterKeyIv: wrappedMasterKey.iv,
      }),
    })

    if (!res.ok) throw new Error('register_failed')

    const data = (await res.json()) as AuthPayload
    await persistToSession(masterKey, data.sessionSecret)
    masterKeyRef.current = masterKey
    setIsUnlocked(true)
  }, [persistToSession])

  const login = useCallback(async (email: string, password: string) => {
    const saltRes = await fetch(`/api/auth/salt?email=${encodeURIComponent(email)}`)
    if (!saltRes.ok) throw new Error('salt_failed')
    const salts = (await saltRes.json()) as { authSalt: string; keySalt: string }

    const [authHash, masterKey] = await Promise.all([
      deriveAuthHash(password, salts.authSalt),
      deriveMasterKey(password, salts.keySalt),
    ])

    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, authHash }),
    })

    if (!loginRes.ok) throw new Error('login_failed')
    const data = (await loginRes.json()) as AuthPayload
    await persistToSession(masterKey, data.sessionSecret)
    masterKeyRef.current = masterKey
    setIsUnlocked(true)
  }, [persistToSession])

  const logout = useCallback(async () => {
    masterKeyRef.current = null
    setIsUnlocked(false)
    sessionStorage.removeItem(WRAPPED_MASTER_KEY)
    sessionStorage.removeItem(WRAPPED_MASTER_KEY_IV)
    await fetch('/api/auth/logout', { method: 'POST' })
  }, [])

  useEffect(() => {
    const restore = async () => {
      const blob = sessionStorage.getItem(WRAPPED_MASTER_KEY)
      const iv = sessionStorage.getItem(WRAPPED_MASTER_KEY_IV)
      if (!blob || !iv) return

      try {
        const res = await fetch('/api/auth/session-secret')
        if (!res.ok) throw new Error('unauthorized')
        const { sessionSecret } = (await res.json()) as AuthPayload
        const kek = await deriveKEK(sessionSecret)
        const masterKey = await unwrapMasterKey(blob, iv, kek)
        masterKeyRef.current = masterKey
        setIsUnlocked(true)
      } catch {
        sessionStorage.removeItem(WRAPPED_MASTER_KEY)
        sessionStorage.removeItem(WRAPPED_MASTER_KEY_IV)
      }
    }

    void restore()
  }, [])

  const value = useMemo(() => ({
    masterKey: masterKeyRef.current,
    isUnlocked,
    register,
    login,
    logout,
  }), [isUnlocked, login, logout, register])

  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>
}

export function useCryptoContext() {
  const value = useContext(CryptoContext)
  if (!value) throw new Error('CryptoProvider missing')
  return value
}
