'use client'
import Calendar from '@/components/app/calendar'
import AuthWaitingLoading from '@/components/app/auth-waiting-loading'
import { useEffect, useMemo, useState } from 'react'

export default function Home() {
  const [sessionChecked, setSessionChecked] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [dbReady, setDbReady] = useState(false)

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const response = await fetch('/api/auth/get-session', {
          cache: 'no-store',
        })
        const data = response.ok ? await response.json() : null
        if (!active) return
        const signedIn =
          data !== null && typeof data === 'object' && 'session' in data
        setIsSignedIn(signedIn)
      } catch {
        if (!active) return
        setIsSignedIn(false)
      } finally {
        if (active) setSessionChecked(true)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!sessionChecked) return
    if (!isSignedIn) {
      setDbReady(true)
      return
    }
    let active = true
    const initAndReady = async () => {
      try {
        // Ensure the user has default data (settings, categories, etc.).
        // The endpoint is idempotent – it's a no-op when data already exists.
        await fetch('/api/init', { method: 'POST', cache: 'no-store' })
      } catch {
        // Initialization failed, but we still let the user through so the
        // app can load with empty state rather than showing a spinner forever.
      }
      if (active) setDbReady(true)
    }
    void initAndReady()
    return () => {
      active = false
    }
  }, [sessionChecked, isSignedIn])

  const shouldShowAuthWait = useMemo(() => {
    if (!sessionChecked) return true
    if (!isSignedIn) return false
    return !dbReady
  }, [sessionChecked, isSignedIn, dbReady])

  if (shouldShowAuthWait) {
    return <AuthWaitingLoading />
  }
  return <Calendar />
}
