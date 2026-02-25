"use client"

import Calendar from "@/components/app/calendar"
import AuthWaitingLoading from "@/components/app/auth-waiting-loading"
import { unlockAfterLogin } from "@/lib/e2ee/client"
import { UnlockRequiredError } from "@/lib/e2ee/errors"
import { useUser } from "@clerk/nextjs"
import { useEffect, useMemo, useState } from "react"

function hasClerkSessionCookie() {
  if (typeof document === "undefined") return false

  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith("__session="))
}

export default function Home() {
  const { isLoaded, isSignedIn, user } = useUser()
  const [hasSessionCookie, setHasSessionCookie] = useState(hasClerkSessionCookie)
  const [minimumWaitDone, setMinimumWaitDone] = useState(false)
  const [atprotoLogoutDone, setAtprotoLogoutDone] = useState(false)
  const [e2eeChecked, setE2eeChecked] = useState(false)

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
    if (!isSignedIn || !user) {
      setE2eeChecked(true)
      return
    }

    unlockAfterLogin(user.id)
      .catch((err) => {
        if (err instanceof UnlockRequiredError) {
          sessionStorage.setItem("e2ee-unlock-required", "1")
          window.dispatchEvent(new Event("one-calendar:e2ee-unlock-required"))
          return
        }

        if (err instanceof Error && "code" in err && err.code === "E2EE_NOT_INITIALIZED") {
          return
        }
      })
      .finally(() => setE2eeChecked(true))
  }, [isLoaded, isSignedIn, user])

  const shouldShowAuthWait = useMemo(() => {
    if (!minimumWaitDone) return true
    if (hasSessionCookie && !isLoaded) return true
    return isSignedIn && !e2eeChecked
  }, [minimumWaitDone, hasSessionCookie, isLoaded, isSignedIn, e2eeChecked])

  if (shouldShowAuthWait) {
    return <AuthWaitingLoading />
  }

  return <Calendar />
}
