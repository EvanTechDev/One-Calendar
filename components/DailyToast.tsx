"use client"

import { useEffect } from "react"
import { toast } from "@/components/ui/use-toast"

export default function DailyToast() {
  useEffect(() => {
    console.log("DailyToast mounted")
    const todayToast = localStorage.getItem("today-toast")
    const language = navigator.language.startsWith("zh") ? "zh" : "en"

    if (!todayToast) {
      toast({
        title: "Welcome back!",
        description: "Hope you have a productive day ☀️",
      })

      localStorage.setItem("today-toast", "true")
    }

    const now = new Date()
    const nextMidnight = new Date()
    nextMidnight.setHours(24, 0, 0, 0)
    const timeout = nextMidnight.getTime() - now.getTime()

    const timer = setTimeout(() => {
      localStorage.removeItem("today-toast")
    }, timeout)

    return () => clearTimeout(timer)
  }, [])

  return null
}
