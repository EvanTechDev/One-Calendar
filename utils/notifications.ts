import { toast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"

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

// 修改 scheduleEventNotification 函数，添加对 notified 的处理
export function scheduleEventNotification(
  event: { id: string; title: string; startDate: Date; description?: string; location?: string; notified?: boolean },
  minutesBefore: number,
  soundType: keyof typeof NOTIFICATION_SOUNDS = "telegramSfx",
): void {
  // 如果事件已经被通知过，则不再安排通知
  if (event.notified) {
    console.log(`事件 ${event.title} 已经通知过，跳过通知安排`)
    return
  }

  // 确保startDate是Date对象
  const eventStartDate = event.startDate instanceof Date ? event.startDate : new Date(event.startDate)
  const eventTime = eventStartDate.getTime()

  // 当minutesBefore为0时，通知时间就是事件时间
  const notificationTime = minutesBefore === 0 ? eventTime : eventTime - minutesBefore * 60 * 1000

  const now = Date.now()

  console.log(`为事件安排通知: ${event.title}`)

  // 清除该事件的任何现有计时器
  if (activeNotificationTimers[event.id]) {
    clearTimeout(activeNotificationTimers[event.id])
    delete activeNotificationTimers[event.id]
    console.log(`已清除事件 ${event.id} 的现有计时器`)
  }

  // Store the notification in localStorage for persistence
  const notifications = JSON.parse(localStorage.getItem("scheduled-notifications") || "[]")

  // 移除该事件的任何现有通知
  const filteredNotifications = notifications.filter((n: any) => n.id !== event.id)

  // 添加新通知
  filteredNotifications.push({
    id: event.id,
    title: event.title,
    body: event.description || (minutesBefore === 0 ? `事件开始时间到了` : `事件将在 ${minutesBefore} 分钟后开始`),
    location: event.location || "",
    timestamp: notificationTime,
    soundType: soundType,
    notified: event.notified || false,
  })

  localStorage.setItem("scheduled-notifications", JSON.stringify(filteredNotifications))

  if (notificationTime <= now) {
    // 如果通知时间已经过去，立即显示通知
    console.log(`通知时间已过，立即显示通知: ${event.title}`)
    showToastNotification(
      event.title,
      event.description || (minutesBefore === 0 ? `事件开始时间到了` : `事件即将开始`),
      event.id,
      soundType,
      event.location,
    )

    // 标记事件为已通知
    markEventAsNotified(event.id)
    return
  }

  // Schedule the notification using setTimeout
  const delay = notificationTime - now
  console.log(`设置通知计时器，延迟: ${delay}ms (${delay / 1000 / 60} 分钟)`)

  // 使用Web Notifications API请求权限并显示通知
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission()
    }
  }

  const timerId = setTimeout(() => {
    console.log(`触发计时器通知: ${event.title}`)

    // 使用Web Notifications API显示系统通知
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        // 播放通知声音
        playNotificationSound(soundType)

        const notification = new Notification(event.title, {
          body: event.description || (minutesBefore === 0 ? `事件开始时间到了` : `事件即将开始`),
          icon: "/calendar-icon.png",
        })

        notification.onclick = () => {
          window.focus()
          window.dispatchEvent(new CustomEvent("view-event", { detail: { eventId: event.id } }))
        }

        // 标记事件为已通知
        markEventAsNotified(event.id)
      } catch (e) {
        console.error("系统通知失败，回退到Toast通知", e)
        showToastNotification(
          event.title,
          event.description || (minutesBefore === 0 ? `事件开始时间到了` : `事件即将开始`),
          event.id,
          soundType,
          event.location,
        )

        // 标记事件为已通知
        markEventAsNotified(event.id)
      }
    } else {
      // 回退到Toast通知
      showToastNotification(
        event.title,
        event.description || (minutesBefore === 0 ? `事件开始时间到了` : `事件即将开始`),
        event.id,
        soundType,
        event.location,
      )

      // 标记事件为已通知
      markEventAsNotified(event.id)
    }

    // 通知显示后，从活跃计时器中移除
    delete activeNotificationTimers[event.id]
  }, delay)

  // 存储计时器ID
  activeNotificationTimers[event.id] = timerId

  console.log(`通知已安排，将在 ${new Date(notificationTime).toLocaleString()} 显示`)
}

// 添加一个新函数，用于标记事件为已通知
function markEventAsNotified(eventId: string): void {
  console.log(`标记事件 ${eventId} 为已通知`)

  // 更新 localStorage 中的通知状态
  const notifications = JSON.parse(localStorage.getItem("scheduled-notifications") || "[]")
  const updatedNotifications = notifications.map((n: any) => {
    if (n.id === eventId) {
      return { ...n, notified: true }
    }
    return n
  })
  localStorage.setItem("scheduled-notifications", JSON.stringify(updatedNotifications))

  // 更新 localStorage 中的事件状态
  const events = JSON.parse(localStorage.getItem("calendar-events") || "[]")
  const updatedEvents = events.map((e: any) => {
    if (e.id === eventId) {
      return { ...e, notified: true }
    }
    return e
  })
  localStorage.setItem("calendar-events", JSON.stringify(updatedEvents))
}

// 修改 checkPendingNotifications 函数，只处理未通知的事件
export function checkPendingNotifications(): void {
  const notifications = JSON.parse(localStorage.getItem("scheduled-notifications") || "[]")
  const now = Date.now()
  const updatedNotifications = []

  console.log(`检查 ${notifications.length} 个待处理通知，当前时间: ${new Date(now).toLocaleString()}`)

  for (const notification of notifications) {
    // 跳过已经通知过的事件
    if (notification.notified) {
      updatedNotifications.push(notification)
      continue
    }

    if (notification.timestamp <= now) {
      // 如果通知时间已经过去，显示它
      console.log(`触发待处理通知: ${notification.title} (计划于 ${new Date(notification.timestamp).toLocaleString()})`)

      // 使用Web Notifications API显示系统通知
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          // 播放通知声音
          playNotificationSound(notification.soundType || "telegramSfx")

          const systemNotification = new Notification(notification.title, {
            body: notification.body,
            icon: "/calendar-icon.png",
          })

          systemNotification.onclick = () => {
            window.focus()
            window.dispatchEvent(new CustomEvent("view-event", { detail: { eventId: notification.id } }))
          }

          // 标记为已通知
          markEventAsNotified(notification.id)

          // 更新通知对象，但仍然保留在列表中
          updatedNotifications.push({ ...notification, notified: true })
        } catch (e) {
          console.error("系统通知失败，回退到Toast通知", e)
          showToastNotification(
            notification.title,
            notification.body,
            notification.id,
            notification.soundType || "telegram",
            notification.location,
          )

          // 标记为已通知
          markEventAsNotified(notification.id)

          // 更新通知对象，但仍然保留在列表中
          updatedNotifications.push({ ...notification, notified: true })
        }
      } else {
        // 回退到Toast通知
        showToastNotification(
          notification.title,
          notification.body,
          notification.id,
          notification.soundType || "telegramSfx",
          notification.location,
        )

        // 标记为已通知
        markEventAsNotified(notification.id)

        // 更新通知对象，但仍然保留在列表中
        updatedNotifications.push({ ...notification, notified: true })
      }
    } else {
      // Keep future notifications
      updatedNotifications.push(notification)
    }
  }

  localStorage.setItem("scheduled-notifications", JSON.stringify(updatedNotifications))
}

// 清理所有通知计时器
export function clearAllNotificationTimers(): void {
  console.log(`清理所有通知计时器: ${Object.keys(activeNotificationTimers).length} 个`)
  Object.values(activeNotificationTimers).forEach((timerId) => {
    clearTimeout(timerId)
  })
  // 清空计时器对象
  Object.keys(activeNotificationTimers).forEach((key) => {
    delete activeNotificationTimers[key]
  })
}

function showToastNotification(
  title: string,
  description: string,
  eventId: string,
  soundType: string,
  location?: string,
) {
  toast({
    title: title,
    description: description,
    action: (
      <ToastAction
        altText="查看"
        onClick={() => {
          window.focus()
          window.dispatchEvent(new CustomEvent("view-event", { detail: { eventId: eventId } }))
        }}
      >
        查看
      </ToastAction>
    ),
  })
}
