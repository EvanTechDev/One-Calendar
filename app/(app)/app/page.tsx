'use client'

import Calendar from '@/components/app/calendar'
import AuthWaitingLoading from '@/components/app/auth-waiting-loading'
import { authClient } from '@/lib/auth-client'
import { useEffect, useMemo, useState } from 'react'

function hasSessionCookieFn() {
  if (typeof document === 'undefined') return false

  return document.cookie
    .split(';')
    .some((cookie) => cookie.trim().startsWith('better-auth.session_token='))
}

export default function Home() {
  const { data: session, isPending } = authClient.useSession()
  const [resolvedSession, setResolvedSession] = useState<any>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const isLoaded = !isPending && sessionChecked
  const isSignedIn = Boolean(session?.user || resolvedSession?.user)
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
        const res = await authClient.getSession()
        if (!active) return
        setResolvedSession((res as any).data || null)
      } finally {
        if (active) setSessionChecked(true)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [isPending])

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
