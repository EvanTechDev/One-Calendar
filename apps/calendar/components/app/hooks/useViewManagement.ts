'use client'

import { useEffect } from 'react'
import { useLocalStorage } from '@zntr/utils/useLocalStorage'
import type { CalendarViewType } from '@/components/app/calendar-types'

export function useViewManagement() {
  const [defaultView, setDefaultView] = useLocalStorage<CalendarViewType>(
    'default-view',
    'week',
  )

  useEffect(() => {
    // This is handled by the main component now
  }, [defaultView])

  return { defaultView, setDefaultView }
}

export function useFirstDayOfWeek() {
  const [firstDayOfWeek, setFirstDayOfWeek] = useLocalStorage<0 | 1 | 6>(
    'first-day-of-week',
    0,
  )

  const normalizedFirstDayOfWeek: 0 | 1 | 6 =
    firstDayOfWeek === 1 || firstDayOfWeek === 6 ? firstDayOfWeek : 0

  const handleFirstDayOfWeekChange = (day: 0 | 1 | 6) => {
    setFirstDayOfWeek(day)
  }

  return {
    firstDayOfWeek: normalizedFirstDayOfWeek,
    setFirstDayOfWeek: handleFirstDayOfWeekChange,
  }
}
