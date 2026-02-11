"use client"
import { useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Calendar from "@/components/app/calendar"
import AuthWaitingLoading from "@/components/app/auth-waiting-loading"

export default function Home() {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const isLocalDevBypass =
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname)

  useEffect(() => {
    if (isLocalDevBypass) return

    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in")
    }
  }, [isLoaded, isSignedIn, isLocalDevBypass, router])

  if (isLocalDevBypass) {
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
