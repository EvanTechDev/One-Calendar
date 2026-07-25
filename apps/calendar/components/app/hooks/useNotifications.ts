'use client'

import { useEffect, useRef } from 'react'
import {
  checkPendingNotifications,
  clearAllNotificationTimers,
  type NOTIFICATION_SOUNDS,
} from '@/lib/notifications'
import type { CalendarEvent } from '@/components/app/calendar'

export function useNotifications(
  events: CalendarEvent[],
  notificationSound: NOTIFICATION_SOUNDS,
) {
  const notificationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const notificationsInitializedRef = useRef(false)

  useEffect(() => {
    if (!notificationsInitializedRef.current) {
      checkPendingNotifications(events, notificationSound)
      notificationsInitializedRef.current = true
    }

    if (!notificationIntervalRef.current) {
      notificationIntervalRef.current = setInterval(() => {
        checkPendingNotifications(events, notificationSound)
      }, 60000)
    }

    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current)
      }
    }
  }, [events, notificationSound])

  useEffect(() => {
    window.addEventListener('beforeunload', clearAllNotificationTimers)
    return () => {
      window.removeEventListener('beforeunload', clearAllNotificationTimers)
    }
  }, [])
}
