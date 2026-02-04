import { toast } from "sonner"
import { readEncryptedLocalStorage } from "@/hooks/useLocalStorage"
import { getStoredLanguage, translations } from "@/lib/i18n"

let notificationInterval: NodeJS.Timeout | null = null;
const firedNotifications = new Map<string, number>()
const NOTIFICATION_GRACE_PERIOD_MS = 2 * 60 * 1000
const NOTIFICATION_CLEANUP_WINDOW_MS = 24 * 60 * 60 * 1000

export type NOTIFICATION_SOUNDS = "telegram";

const notificationSounds: Record<NOTIFICATION_SOUNDS, string> = {
  telegram: "https://cdn.xyehr.cn/source/Voicy_Telegram_notification.mp3",
};

// 清除所有的通知计时器
export const clearAllNotificationTimers = () => {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
};

// 检查待处理的通知
export const checkPendingNotifications = async (sound: NOTIFICATION_SOUNDS = "telegram") => {
  const now = Date.now()
  const pendingEvents = await getPendingEvents(now)

  await Promise.all(
    pendingEvents.map(async (event) => {
      triggerNotification(event, sound)
      markNotificationFired(event, now)
      await showToast(event)
    }),
  )
};

// 获取待处理的事件
const getPendingEvents = async (currentTime: number) => {
  cleanupFiredNotifications(currentTime)
  const events = await readEncryptedLocalStorage<any[]>("calendar-events", [])
  return events.filter((event: any) => {
    const notificationTime = getNotificationTime(event)
    if (!notificationTime) return false
    if (notificationTime > currentTime) return false
    if (notificationTime <= currentTime - NOTIFICATION_GRACE_PERIOD_MS) return false
    const key = getNotificationKey(event, notificationTime)
    return !firedNotifications.has(key)
  })
};

// 播放通知声音
const triggerNotification = async (event: any, soundKey: NOTIFICATION_SOUNDS) => {
  const sound = notificationSounds[soundKey] ?? notificationSounds.telegram
  const audio = new Audio(sound)
  audio.play().catch(() => {})
  await showSystemNotification(event)
};

// 显示 Toast 通知
const showToast = async (event: any) => {
  const language = await getStoredLanguage()
  const t = translations[language]
  toast(`${event.title}`, {
    description: event.description || t.noContent,
    duration: 4000,
  });
};

const showSystemNotification = async (event: any) => {
  if (typeof window === "undefined") return
  if (!("Notification" in window)) return

  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission()
    } catch {
      return
    }
  }

  if (Notification.permission !== "granted") return

  const language = await getStoredLanguage()
  const t = translations[language]

  const title = event.title || "Calendar"
  const body = event.description || t.noContent
  const tag = event.id ? `event-${event.id}` : "calendar-event"

  try {
    new Notification(title, {
      body,
      tag,
    })
  } catch {
    return
  }
}

const getNotificationTime = (event: any) => {
  if (!event?.startDate) return null
  const startTime = new Date(event.startDate).getTime()
  if (Number.isNaN(startTime)) return null
  const notificationMinutes = Number.isFinite(event.notification) ? event.notification : 0
  if (notificationMinutes < 0) return null
  return startTime - notificationMinutes * 60 * 1000
}

const getNotificationKey = (event: any, notificationTime: number) => {
  const eventId = event?.id ?? "unknown"
  return `${eventId}-${notificationTime}`
}

const markNotificationFired = (event: any, currentTime: number) => {
  const notificationTime = getNotificationTime(event)
  if (!notificationTime) return
  const key = getNotificationKey(event, notificationTime)
  firedNotifications.set(key, currentTime)
}

const cleanupFiredNotifications = (currentTime: number) => {
  firedNotifications.forEach((timestamp, key) => {
    if (currentTime - timestamp > NOTIFICATION_CLEANUP_WINDOW_MS) {
      firedNotifications.delete(key)
    }
  })
}

export const startNotificationChecking = () => {
  if (!notificationInterval) {
    notificationInterval = setInterval(() => {
      checkPendingNotifications();
    }, 30000);
  }
};

export const stopNotificationChecking = () => {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
};
