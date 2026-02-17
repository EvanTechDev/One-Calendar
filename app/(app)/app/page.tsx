"use client"

import Calendar from "@/components/app/calendar"
import AuthWaitingLoading from "@/components/app/auth-waiting-loading"
import { useUser } from "@clerk/nextjs"
import { useEffect, useMemo, useState } from "react"

const AUTH_FLOW_ROUTES = ["/sign-in", "/sign-up", "/reset-password", "/sso-callback"]

function isFromAuthFlow(referrer: string) {
  if (!referrer) return false

  try {
    const refUrl = new URL(referrer)
    return AUTH_FLOW_ROUTES.some((route) => refUrl.pathname.includes(route))
  } catch {
    return false
  }
}

export default function Home() {
  const { isLoaded } = useUser()
  const [cameFromAuthFlow, setCameFromAuthFlow] = useState(false)
  const [showDelayedWait, setShowDelayedWait] = useState(false)

  useEffect(() => {
    setCameFromAuthFlow(isFromAuthFlow(document.referrer))
  }, [])

  useEffect(() => {
    if (!cameFromAuthFlow || isLoaded) {
      setShowDelayedWait(false)
      return
    }

    const timer = window.setTimeout(() => {
      setShowDelayedWait(true)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [cameFromAuthFlow, isLoaded])

  const shouldShowAuthWait = useMemo(() => {
    return cameFromAuthFlow && !isLoaded && showDelayedWait
  }, [cameFromAuthFlow, isLoaded, showDelayedWait])

  if (shouldShowAuthWait) {
    return <AuthWaitingLoading />
  }

  return <Calendar />
}
