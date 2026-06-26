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
    const checkDb = async () => {
      try {
        const response = await fetch('/api/blob', { cache: 'no-store' })
        if (!active) return
        if (response.status === 200 || response.status === 404) {
          setDbReady(true)
        }
      } catch {
        if (active) setDbReady(true)
      }
    }
    void checkDb()
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
