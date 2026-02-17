"use client"

import Calendar from "@/components/app/calendar"
import AuthWaitingLoading from "@/components/app/auth-waiting-loading"
import { useUser } from "@clerk/nextjs"
import { useMemo, useState } from "react"

function hasClerkSessionCookie() {
  if (typeof document === "undefined") return false

  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith("__session="))
}

export default function Home() {
  const { isLoaded } = useUser()
  const [hasSessionCookie] = useState(hasClerkSessionCookie)

  const shouldShowAuthWait = useMemo(() => {
    return hasSessionCookie && !isLoaded
  }, [hasSessionCookie, isLoaded])

  if (shouldShowAuthWait) {
    return <AuthWaitingLoading />
  }

  return <Calendar />
}
