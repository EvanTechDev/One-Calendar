"use client"

import { translations, useLanguage } from "@/lib/i18n"
import { useEffect, useState } from "react"
import Image from "next/image"
import { hasTrustedDeviceRecord } from "@/lib/e2ee-client"

export default function AuthWaitingLoading() {
  const [language] = useLanguage()
  const t = translations[language]
  const [dotCount, setDotCount] = useState(1)
  const [checkingIndexedDb, setCheckingIndexedDb] = useState(true)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1))
    }, 450)

    hasTrustedDeviceRecord().finally(() => {
      setCheckingIndexedDb(false)
    })

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-black">
      <div className="flex flex-col items-center gap-5 text-center">
        <Image src="/icon.svg" alt="One Calendar" width={128} height={128} priority />
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {checkingIndexedDb ? "Checking trusted device storage" : t.loadingCalendar}
          {".".repeat(dotCount)}
        </p>
      </div>
    </div>
  )
}
