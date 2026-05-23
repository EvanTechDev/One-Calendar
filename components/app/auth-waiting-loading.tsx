'use client'

import { translations, useLanguage } from '@/lib/i18n'
import { useEffect, useState } from 'react'

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
        <svg
          width="96"
          height="96"
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="One Calendar"
          role="img"
          className="text-black dark:text-white"
        >
          <circle cx="48" cy="14" r="9" fill="currentColor" />
          <circle cx="30" cy="31" r="9" fill="currentColor" />
          <circle cx="48" cy="31" r="9" fill="currentColor" />
          <circle cx="48" cy="48" r="9" fill="currentColor" />
          <circle cx="48" cy="65" r="9" fill="currentColor" />
          <circle cx="30" cy="82" r="9" fill="currentColor" />
          <circle cx="48" cy="82" r="9" fill="currentColor" />
          <circle cx="66" cy="82" r="9" fill="currentColor" />
        </svg>
        <p className="font-geist-mono text-sm text-slate-700 dark:text-slate-300">
          {t.loadingCalendar}
          {'.'.repeat(dotCount)}
        </p>
      </div>
    </div>
  )
}
