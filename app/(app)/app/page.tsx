'use client'

import Calendar from '@/components/app/calendar'
import AuthWaitingLoading from '@/components/app/auth-waiting-loading'
import { useEffect, useMemo, useState } from 'react'

function hasSessionCookieFn() {
  if (typeof document === 'undefined') return false

  return document.cookie
    .split(';')
    .some((cookie) => cookie.trim().startsWith('better-auth.session_token='))
}

export default function Home() {
  const [apiSession, setApiSession] = useState<any>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const isLoaded = sessionChecked
  const isSignedIn = Boolean(apiSession?.user)
  const [hasSessionCookie, setHasSessionCookie] = useState(hasSessionCookieFn)
  const [minimumWaitDone, setMinimumWaitDone] = useState(false)
  const [authStabilized, setAuthStabilized] = useState(false)
  const [dbReady, setDbReady] = useState(false)

  useEffect(() => {
    const waitTimer = window.setTimeout(() => {
      setMinimumWaitDone(true)
    }, 500)

    const cookieCheckTimer = window.setInterval(() => {
      if (hasSessionCookieFn()) {
        setHasSessionCookie(true)
      }
    }, 50)

    return () => {
      window.clearTimeout(waitTimer)
      window.clearInterval(cookieCheckTimer)
    }
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const response = await fetch('/api/auth/get-session', { cache: 'no-store' })
        const data = response.ok ? await response.json() : null
        if (!active) return
        setApiSession(data)
      } catch {
        if (!active) return
        setApiSession(null)
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
    if (isSignedIn) {
      setAuthStabilized(true)
      return
    }
    const timer = window.setTimeout(() => setAuthStabilized(true), 1500)
    return () => window.clearTimeout(timer)
  }, [isSignedIn])


  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      setDbReady(true)
      return
    }

    let active = true
    const checkDbDataReady = async () => {
      try {
        const response = await fetch('/api/blob', { cache: 'no-store' })
        if (!active) return
        if (response.status === 200 || response.status === 404) {
          setDbReady(true)
          return
        }
        setDbReady(false)
      } catch {
        if (active) {
          setDbReady(false)
        }
      }
    }

    void checkDbDataReady()
    return () => {
      active = false
    }
  }, [isLoaded, isSignedIn])

  const shouldShowAuthWait = useMemo(() => {
    if (!minimumWaitDone) return true
    if (hasSessionCookie && !isLoaded) return true
    if (!isSignedIn && !authStabilized) return true
    if (isSignedIn && !dbReady) return true
    return false
  }, [minimumWaitDone, hasSessionCookie, isLoaded, isSignedIn, dbReady, authStabilized])

  if (shouldShowAuthWait) {
    return <AuthWaitingLoading />
  }

  return <Calendar />
}
