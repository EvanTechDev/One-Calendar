'use client'

import { useEffect } from 'react'
import { readEncryptedLocalStorage } from '@zntr/utils/useLocalStorage'
import type {
  CalendarViewType,
  FirstDayOfWeek,
} from '@/components/app/calendar-types'
import { isCalendarView } from '@/components/app/calendar-types'
import { useLocalStorage } from '@zntr/utils/useLocalStorage'

export function usePreferences() {
  const [firstDayOfWeek, setFirstDayOfWeek] = useLocalStorage<FirstDayOfWeek>(
    'first-day-of-week',
    0,
  )
  const [timezone, setTimezone] = useLocalStorage<string>(
    'timezone',
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [notificationSound, setNotificationSound] = useLocalStorage<string>(
    'notification-sound',
    'telegram',
  )
  const [defaultView, setDefaultView] = useLocalStorage<CalendarViewType>(
    'default-view',
    'week',
  )
  const [enableShortcuts, setEnableShortcuts] = useLocalStorage<boolean>(
    'enable-shortcuts',
    true,
  )
  const [timeFormat, setTimeFormat] = useLocalStorage<'24h' | '12h'>(
    'time-format',
    '24h',
  )
  const [toastPosition, setToastPosition] = useLocalStorage<
    'bottom-left' | 'bottom-center' | 'bottom-right'
  >('toast-position', 'bottom-right')

  useEffect(() => {
    const applyRestoredPreferences = async () => {
      const [restoredFirstDayOfWeek, restoredDefaultView] = await Promise.all([
        readEncryptedLocalStorage<FirstDayOfWeek>('first-day-of-week', 0),
        readEncryptedLocalStorage<CalendarViewType>('default-view', 'week'),
      ])

      setFirstDayOfWeek(
        restoredFirstDayOfWeek === 1 || restoredFirstDayOfWeek === 6
          ? restoredFirstDayOfWeek
          : 0,
      )
      if (isCalendarView(restoredDefaultView)) {
        setDefaultView(restoredDefaultView)
      }
    }

    applyRestoredPreferences()

    window.addEventListener('backup-restored', applyRestoredPreferences)
    return () => {
      window.removeEventListener('backup-restored', applyRestoredPreferences)
    }
  }, [setDefaultView, setFirstDayOfWeek])

  const handleFirstDayOfWeekChange = (day: FirstDayOfWeek) => {
    setFirstDayOfWeek(day)
  }

  return {
    firstDayOfWeek,
    setFirstDayOfWeek: handleFirstDayOfWeekChange,
    timezone,
    setTimezone,
    notificationSound,
    setNotificationSound,
    defaultView,
    setDefaultView,
    enableShortcuts,
    setEnableShortcuts,
    timeFormat,
    setTimeFormat,
    toastPosition,
    setToastPosition,
  }
}
