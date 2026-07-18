'use client'

import { useEffect, useState } from 'react'
import { readEncryptedLocalStorage } from '@zntr/utils/useLocalStorage'
import type { FirstDayOfWeek } from '@/components/app/calendar-types'
import { isCalendarView } from '@/components/app/calendar-types'

interface UsePreferencesReturn {
  firstDayOfWeek: FirstDayOfWeek
  setFirstDayOfWeek: (day: FirstDayOfWeek) => void
  timezone: string
  setTimezone: (tz: string) => void
  notificationSound: string
  setNotificationSound: (sound: string) => void
  defaultView: string
  setDefaultView: (view: string) => void
  enableShortcuts: boolean
  setEnableShortcuts: (enabled: boolean) => void
  timeFormat: '24h' | '12h'
  setTimeFormat: (format: '24h' | '12h') => void
  toastPosition: 'bottom-left' | 'bottom-center' | 'bottom-right'
  setToastPosition: (
    position: 'bottom-left' | 'bottom-center' | 'bottom-right',
  ) => void
}

export function usePreferences(): UsePreferencesReturn {
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<FirstDayOfWeek>(0)
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [notificationSound, setNotificationSound] = useState('telegram')
  const [defaultView, setDefaultView] = useState('week')
  const [enableShortcuts, setEnableShortcuts] = useState(true)
  const [timeFormat, setTimeFormat] = useState<'24h' | '12h'>('24h')
  const [toastPosition, setToastPosition] = useState<
    'bottom-left' | 'bottom-center' | 'bottom-right'
  >('bottom-right')

  useEffect(() => {
    const applyRestoredPreferences = async () => {
      const [restoredFirstDayOfWeek, restoredDefaultView] = await Promise.all([
        readEncryptedLocalStorage<FirstDayOfWeek>('first-day-of-week', 0),
        readEncryptedLocalStorage<string>('default-view', 'week'),
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
  }, [])

  const handleFirstDayOfWeekChange = (day: 0 | 1 | 6) => {
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
