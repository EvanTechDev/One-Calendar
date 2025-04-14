"use client"

import { useEffect, useState } from "react"

// 存储所有活跃的通知计时器
const activeNotificationTimers: Record<string, NodeJS.Timeout> = {}

// 通知声音
export const NOTIFICATION_SOUNDS = {
  telegram: "https://cdn.xyehr.cn/source/Voicy_Telegram_notification.mp3",
  telegramSfx: "https://cdn.xyehr.cn/source/Voicy_Telegram_SFX_5.mp3",
}

// 播放通知声音
export function playNotificationSound(soundType: keyof typeof NOTIFICATION_SOUNDS = "telegramSfx") {
  try {
    const audio = new Audio(NOTIFICATION_SOUNDS[soundType])
    audio.play().catch((error) => {
      console.error("播放通知声音失败:", error)
    })
  } catch (error) {
    console.error("创建音频对象失败:", error)
  }
}

// 💡 在用户进入页面时检查/请求通知权限（仅请求一次）
export function useNotificationPermission() {
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return

    const permission = Notification.permission
    const alreadyAsked = localStorage.getItem("notification-permission-asked") === "true"

    if (permission !== "default" || alreadyAsked) {
      setRequested(true)
      return
    }

    Notification.requestPermission().then((result) => {
      localStorage.setItem("notification-permission-asked", "true")
      setRequested(true)
      console.log("通知权限结果:", result)
    })
  }, [])

  return requested
}

export function scheduleEventNotification(
  event: { id: string; title: string; startDate: Date; description?: string; location?: string },
  minutesBefore: number,
  soundType: keyof typeof NOTIFICATION_SOUNDS = "telegramSfx",
): void {
  const eventStartDate = event.startDate instanceof Date ? event.startDate : new Date(event.startDate)
  const eventTime = eventStartDate.getTime()
  const notificationTime = minutesBefore === 0 ? eventTime : eventTime - minutesBefore * 60 * 1000
  const now = Date.now()

  if (activeNotificationTimers[event.id]) {
    clearTimeout(activeNotificationTimers[event.id])
    delete activeNotificationTimers[event.id]
  }

  const language = localStorage.getItem("preferred-language") || "zh"
  const notificationBody =
    language === "en"
      ? minutesBefore === 0
        ? `Event time has arrived`
        : `Event will start in ${minutesBefore} minutes`
      : minutesBefore === 0
        ? `事件开始时间到了`
        : `事件将在 ${minutesBefore} 分钟后开始`

  const notifications = JSON.parse(localStorage.getItem("scheduled-notifications") || "[]")
  const filteredNotifications = notifications.filter((n: any) => n.id !== event.id)
  filteredNotifications.push({
    id: event.id,
    title: event.title,
    body: event.description || notificationBody,
    location: event.location || "",
    timestamp: notificationTime,
    soundType: soundType,
    language: language,
  })
  localStorage.setItem("scheduled-notifications", JSON.stringify(filteredNotifications))

  if (notificationTime <= now) {
    triggerNotification(event, notificationBody, soundType)
    return
  }

  const delay = notificationTime - now
  const timerId = setTimeout(() => {
    const currentLanguage = localStorage.getItem("preferred-language") || "zh"
    const currentNotificationBody =
      currentLanguage === "en"
        ? minutesBefore === 0
          ? `Event time has arrived`
          : `Event will start in ${minutesBefore} minutes`
        : minutesBefore === 0
          ? `事件开始时间到了`
          : `事件将在 ${minutesBefore} 分钟后开始`

    triggerNotification(event, currentNotificationBody, soundType)
    delete activeNotificationTimers[event.id]
  }, delay)

  activeNotificationTimers[event.id] = timerId
}

function triggerNotification(
  event: { id: string; title: string; description?: string; location?: string },
  body: string,
  soundType: keyof typeof NOTIFICATION_SOUNDS = "telegramSfx"
) {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      playNotificationSound(soundType)
      const notification = new Notification(event.title, {
        body: event.description || body,
        icon: "/calendar-icon.png",
      })

      notification.onclick = () => {
        window.focus()
        window.dispatchEvent(new CustomEvent("preview-event", { detail: { eventId: event.id } }))
      }
    } catch (e) {
      console.error("系统通知失败:", e)
    }
  } else {
    console.warn("没有通知权限，无法显示系统通知")
  }
}

export function checkPendingNotifications(): void {
  const notifications = JSON.parse(localStorage.getItem("scheduled-notifications") || "[]")
  const now = Date.now()
  const updatedNotifications = []

  for (const notification of notifications) {
    if (notification.timestamp <= now) {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          playNotificationSound(notification.soundType || "telegramSfx")
          const systemNotification = new Notification(notification.title, {
            body: notification.body,
            icon: "/calendar-icon.png",
          })

          systemNotification.onclick = () => {
            window.focus()
            window.dispatchEvent(new CustomEvent("preview-event", { detail: { eventId: notification.id } }))
          }
        } catch (e) {
          console.error("系统通知失败", e)
        }
      } else {
        console.warn("没有通知权限，无法显示系统通知")
      }
    } else {
      updatedNotifications.push(notification)
    }
  }

  localStorage.setItem("scheduled-notifications", JSON.stringify(updatedNotifications))
}

export function clearAllNotificationTimers(): void {
  Object.values(activeNotificationTimers).forEach((timerId) => clearTimeout(timerId))
  Object.keys(activeNotificationTimers).forEach((key) => delete activeNotificationTimers[key])
}
