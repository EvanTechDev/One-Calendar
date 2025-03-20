// 请求通知权限
export function requestNotificationPermission() {
  if (typeof window !== "undefined" && "Notification" in window) {
    // 如果已经有权限，直接返回
    if (Notification.permission === "granted") {
      return Promise.resolve(true)
    }

    // 如果已经被拒绝，也直接返回
    if (Notification.permission === "denied") {
      return Promise.resolve(false)
    }

    // 否则请求权限
    return Notification.requestPermission().then((permission) => {
      return permission === "granted"
    })
  }

  return Promise.resolve(false)
}

// 替换为不自动请求权限的版本
export function checkNotificationPermission() {
  if (typeof window !== "undefined" && "Notification" in window) {
    // 如果已经有权限，直接返回
    if (Notification.permission === "granted") {
      return Promise.resolve(true)
    }

    // 如果已经被拒绝，也直接返回
    if (Notification.permission === "denied") {
      return Promise.resolve(false)
    }

    // 返回当前状态，但不自动请求权限
    // 只有在用户明确触发操作时才应该请求权限
    return Promise.resolve(false)
  }

  return Promise.resolve(false)
}

