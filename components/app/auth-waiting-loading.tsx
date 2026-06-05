'use client'

import { Skeleton } from '@/components/ui/skeleton'
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
    <div className="flex min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid flex-1 gap-4 md:grid-cols-[220px_1fr]">
          <aside className="space-y-5 rounded-lg border p-4">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-full" />
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          </aside>
          <main className="rounded-lg border p-4">
            <div className="mb-4 grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="h-5 w-full" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 28 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          </main>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {t.loadingCalendar}
          {'.'.repeat(dotCount)}
        </p>
      </div>
    </div>
  )
}
