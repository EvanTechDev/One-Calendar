'use client'

import { translations, useLanguage } from '@zntr/i18n/calendar'
import { useEffect, useState } from 'react'
import { ZentraLogo } from '@/components/brand/zentra-logo'

export default function AuthWaitingLoading() {
  const [language] = useLanguage()
  const t = translations[language]
  const [dotCount, setDotCount] = useState(1)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1))
    }, 450)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-black">
      <div className="flex flex-col items-center gap-5 text-center">
        {/* 136px, matching the mark this replaced. */}
        <ZentraLogo className="size-[136px]" />
        <p className={`text-sm text-slate-700 dark:text-slate-300`}>
          {t.loadingCalendar}
          {'.'.repeat(dotCount)}
        </p>
      </div>
    </div>
  )
}
