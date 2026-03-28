"use client"

import Calendar from "@/components/app/calendar"
import AuthWaitingLoading from "@/components/app/auth-waiting-loading"
import { useUser } from "@clerk/nextjs"
import { useEffect, useMemo, useState } from "react"

function hasClerkSessionCookie() {
  if (typeof document === "undefined") return false

  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith("__session="))
}

export default function Home() {
  const { isLoaded, isSignedIn } = useUser()
  const [hasSessionCookie, setHasSessionCookie] = useState(hasClerkSessionCookie)
  const [minimumWaitDone, setMinimumWaitDone] = useState(false)
  const [atprotoLogoutDone, setAtprotoLogoutDone] = useState(false)
  const [dbReady, setDbReady] = useState(false)
  const [atprotoSignedIn, setAtprotoSignedIn] = useState(false)
  const [atprotoDs, setAtprotoDs] = useState<string | null>(null)

  useEffect(() => {
    const waitTimer = window.setTimeout(() => {
      setMinimumWaitDone(true)
    }, 500)


    const cookieCheckTimer = window.setInterval(() => {
      if (hasClerkSessionCookie()) {
        setHasSessionCookie(true)
      }
    }, 50)

    return () => {
      window.clearTimeout(waitTimer)
      window.clearInterval(cookieCheckTimer)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || atprotoLogoutDone) return
    fetch("/api/atproto/logout", { method: "POST" })
      .catch(() => undefined)
      .finally(() => setAtprotoLogoutDone(true))
  }, [isLoaded, isSignedIn, atprotoLogoutDone])



  useEffect(() => {
    if (!isLoaded) return

    let active = true
    const checkDbDataReady = async () => {
      try {
        if (!isSignedIn) {
          const sessionRes = await fetch("/api/atproto/session", {
            cache: "no-store",
          })
          const sessionData = await sessionRes
            .json()
            .catch(() => ({ signedIn: false })) as { signedIn?: boolean }

          if (active) {
            setAtprotoSignedIn(!!sessionData.signedIn)
          }

          if (!sessionData.signedIn) {
            if (active) setDbReady(true)
            return
          }

          const dsRes = await fetch("/api/ds/config", { cache: "no-store" })
          const dsData = await dsRes
            .json()
            .catch(() => ({ ds: null })) as { ds?: string | null }
          if (active) {
            setAtprotoDs(dsData.ds || null)
            window.dispatchEvent(
              new CustomEvent("atproto-ds-updated", {
                detail: { ds: dsData.ds || null },
              }),
            )
          }
        }

        const response = await fetch("/api/blob", { cache: "no-store" })
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
    if (isSignedIn && !dbReady) return true
    return false
  }, [minimumWaitDone, hasSessionCookie, isLoaded, isSignedIn, dbReady])

  if (shouldShowAuthWait) {
    return <AuthWaitingLoading />
  }

  return <Calendar />
}
