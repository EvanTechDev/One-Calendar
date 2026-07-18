'use client'

import { useEffect, useRef } from 'react'
import {
  checkPendingNotifications,
  clearAllNotificationTimers,
  type NOTIFICATION_SOUNDS,
} from '@/lib/notifications'

export function useNotifications(notificationSound: NOTIFICATION_SOUNDS) {
  const notificationsInitializedRef = useRef(false)
  const notificationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!notificationsInitializedRef.current) {
      checkPendingNotifications(notificationSound)
      notificationsInitializedRef.current = true
    }

    if (!notificationIntervalRef.current) {
      notificationIntervalRef.current = setInterval(() => {
        checkPendingNotifications(notificationSound)
      }, 60000)
    }

    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current)
      }
    }
  }, [notificationSound])

  useEffect(() => {
    window.addEventListener('beforeunload', clearAllNotificationTimers)
    return () => {
      window.removeEventListener('beforeunload', clearAllNotificationTimers)
    }
  }, [])
}
