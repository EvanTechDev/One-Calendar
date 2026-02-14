"use client"
import AuthWaitingLoading from "@/components/app/auth-waiting-loading"
import Calendar from "@/components/app/calendar"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useEffect } from "react"

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
