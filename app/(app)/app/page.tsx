'use client'

import Calendar from '@/components/app/calendar'
import AuthWaitingLoading from '@/components/app/auth-waiting-loading'
import { authClient } from '@/lib/auth-client'
import { useEffect, useMemo, useState } from 'react'

function detectAuthSessionCookie() {
  if (typeof document === 'undefined') return false

  return document.cookie
    .split(';')
    .some((cookie) => cookie.trim().startsWith('better-auth.session_token='))
}

export default function Home() {
  const { data: session, isPending } = authClient.useSession()
  const isLoaded = !isPending
  const isSignedIn = Boolean(session?.user)
  const [hasAuthCookie, setHasAuthCookie] = useState(detectAuthSessionCookie)
  const [minimumWaitDone, setMinimumWaitDone] = useState(false)
  const [atprotoLogoutDone, setAtprotoLogoutDone] = useState(false)
  const [dbReady, setDbReady] = useState(false)

  useEffect(() => {
    const waitTimer = window.setTimeout(() => {
      setMinimumWaitDone(true)
    }, 500)

    const cookieCheckTimer = window.setInterval(() => {
      if (detectAuthSessionCookie()) {
        setHasAuthCookie(true)
      }
    }, 50)

    return () => {
      window.clearTimeout(waitTimer)
      window.clearInterval(cookieCheckTimer)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || atprotoLogoutDone) return
    fetch('/api/atproto/logout', { method: 'POST' })
      .catch(() => undefined)
      .finally(() => setAtprotoLogoutDone(true))
  }, [isLoaded, isSignedIn, atprotoLogoutDone])

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
    if (hasAuthCookie && !isLoaded) return true
    if (isSignedIn && !dbReady) return true
    return false
  }, [minimumWaitDone, hasAuthCookie, isLoaded, isSignedIn, dbReady])

  if (shouldShowAuthWait) {
    return <AuthWaitingLoading />
  }

  return <Calendar />
}
