import { toast } from "sonner";
import { readEncryptedLocalStorage } from "@/hooks/useLocalStorage";

let notificationInterval: NodeJS.Timeout | null = null;

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
export const checkPendingNotifications = async () => {
  const now = Date.now();
  const pendingEvents = await getPendingEvents(now);

  pendingEvents.forEach((event) => {
    triggerNotification(event);
    showToast(event);
  });
};

// 获取待处理的事件
const getPendingEvents = async (currentTime: number) => {
  const events = await readEncryptedLocalStorage<any[]>("calendar-events", []);
  return events.filter((event: any) => event.notificationTime <= currentTime);
};

// 播放通知声音
const triggerNotification = (event: any) => {
  const sound = notificationSounds["telegram"];
  new Audio(sound).play();
};

// 显示 Toast 通知
const showToast = (event: any) => {
  toast(`${event.title}`, {
    description: event.description || "No content",
    duration: 4000,
  });
};


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
