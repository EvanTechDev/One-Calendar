"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { readEncryptedLocalStorage, writeEncryptedLocalStorage } from "@/hooks/useLocalStorage"
import { useLanguage } from "@/lib/i18n"

export default function DailyToast() {
  const [ready, setReady] = useState(false)
  const [language] = useLanguage()

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready) return

    const today = new Date().toISOString().split("T")[0]
    readEncryptedLocalStorage<string | null>("today-toast", null).then((toastShown) => {
      if (toastShown !== today) {
        const isZh = language === "zh"
        toast(isZh ? "📅 欢迎回来！" : "📅 Welcome back!", {
          description: isZh ? "查看你今天的日程吧。" : "Check your schedule for today.",
        })

        void writeEncryptedLocalStorage("today-toast", today)
      }
    })
  }, [ready])

  return null
}
