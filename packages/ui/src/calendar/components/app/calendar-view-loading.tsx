'use client'

import { translations, useLanguage } from '@zntr/i18n/calendar'
import { Loader2 } from 'lucide-react'

export default function CalendarViewLoading() {
  const [language] = useLanguage()
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex min-h-64 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      {translations[language].loadingCalendar}
    </div>
  )
}
