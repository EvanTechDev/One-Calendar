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
  const { isLoaded } = useUser()
  const [hasSessionCookie, setHasSessionCookie] = useState(hasClerkSessionCookie)
  const [minimumWaitDone, setMinimumWaitDone] = useState(false)

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

  const shouldShowAuthWait = useMemo(() => {
    if (!minimumWaitDone) return true
    return hasSessionCookie && !isLoaded
  }, [minimumWaitDone, hasSessionCookie, isLoaded])

  if (shouldShowAuthWait) {
    return <AuthWaitingLoading />
  }

  return <Calendar />
}
