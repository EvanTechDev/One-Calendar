"use client"

import { readEncryptedLocalStorage, writeEncryptedLocalStorage } from "@/hooks/useLocalStorage"
import { translations, useLanguage } from "@/lib/i18n"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function DailyToast() {
  const [ready, setReady] = useState(false)
  const [language] = useLanguage()
  const t = translations[language]

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready) return

    const today = new Date().toISOString().split("T")[0]
    readEncryptedLocalStorage<string | null>("today-toast", null).then((toastShown) => {
      if (toastShown !== today) {
        toast(t.welcomeBackTitle, {
          description: t.welcomeBackDescription,
        })

        void writeEncryptedLocalStorage("today-toast", today)
      }
    })
  }, [ready])

  return null
}
