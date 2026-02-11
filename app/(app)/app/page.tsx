"use client"
import { useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Calendar from "@/components/app/calendar"
import AuthWaitingLoading from "@/components/app/auth-waiting-loading"

export default function Home() {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const isAuthBypassEnabled =
    process.env.NEXT_PUBLIC_BYPASS_CLERK_AUTH === "true" ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"

  useEffect(() => {
    if (isAuthBypassEnabled) return

    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in")
    }
  }, [isLoaded, isSignedIn, isAuthBypassEnabled, router])

  if (isAuthBypassEnabled) {
    return <Calendar />
  }

  if (!isLoaded) {
    return <AuthWaitingLoading />
  }

  if (!isSignedIn) {
    return null
  }

  return <Calendar />
}
