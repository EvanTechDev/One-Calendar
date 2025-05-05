"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function DailyToast() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready) return

    const today = new Date().toISOString().split("T")[0]
    const toastShown = localStorage.getItem("today-toast")

    if (toastShown !== today) {
      const isZh = navigator.language.startsWith("zh")
      toast(isZh ? "📅 欢迎回来！" : "📅 Welcome back!", {
        description: isZh ? "查看你今天的日程吧。" : "Check your schedule for today.",
      })

      localStorage.setItem("today-toast", today)
    }
  }, [ready])

  return null
}
