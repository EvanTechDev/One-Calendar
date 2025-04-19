import { toast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"

export type NOTIFICATION_SOUNDS = "telegram";

const notificationSounds: Record<NOTIFICATION_SOUNDS, string> = {
  telegram: "https://cdn.xyehr.cn/source/Voicy_Telegram_notification.mp3",
};

// 清除所有的通知计时器
export const clearAllNotificationTimers = () => {
  if (notificationIntervalRef.current) {
    clearInterval(notificationIntervalRef.current);
    notificationIntervalRef.current = null;
  }
};

// 检查待处理的通知
export const checkPendingNotifications = () => {
  const now = Date.now();
  const pendingEvents = getPendingEvents(now);
  
  pendingEvents.forEach((event) => {
    // 播放通知声音
    triggerNotification(event);
    // 显示 Toast 通知
    showToast(event);
  });
};

// 获取待处理的事件
const getPendingEvents = (currentTime: number) => {
  const events = JSON.parse(localStorage.getItem("events") || "[]");
  return events.filter((event: any) => event.notificationTime <= currentTime);
};

// 触发通知声音
const triggerNotification = (event: any) => {
  const sound = notificationSounds[event.notificationSound || "telegram"];
  new Audio(sound).play(); // 播放声音
};

// 显示 Toast 通知
const showToast = (event: any) => {
  const toastMessage = `Event: ${event.title} is due now!`; // 你可以自定义消息内容
  toast({
    title: toastMessage,
    description: event.description || "No description provided.",
    type: "info", // 可以根据情况改变类型
    duration: 4000, // Toast 持续时间
  });
};

// 设置通知声音
export const setNotificationSound = (sound: NOTIFICATION_SOUNDS) => {
  localStorage.setItem("notification-sound", sound);
};

// 获取通知声音
export const getNotificationSound = (): NOTIFICATION_SOUNDS => {
  return (localStorage.getItem("notification-sound") as NOTIFICATION_SOUNDS) || "telegram";
};

// 使用 ref 记录定时器
let notificationIntervalRef = useRef<NodeJS.Timeout | null>(null);

// 每隔一分钟检查待处理的通知
export const startNotificationChecking = () => {
  if (!notificationIntervalRef.current) {
    notificationIntervalRef.current = setInterval(() => {
      checkPendingNotifications();
    }, 60000);
  }
};

// 停止通知检查
export const stopNotificationChecking = () => {
  if (notificationIntervalRef.current) {
    clearInterval(notificationIntervalRef.current);
    notificationIntervalRef.current = null;
  }
};
