/** Delivery rules shared by the web notifier and the native reminder feed. */
export interface ReminderEvent {
  id: string
  startDate: string | Date
  notification?: number | null
}

export const CATCH_UP_FLOOR_MS = 5 * 60 * 1000
export const FIRED_RECORD_TTL_MS = 24 * 60 * 60 * 1000

export function getReminderTime(event: ReminderEvent): number | null {
  const minutes = event.notification
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null
  const start = new Date(event.startDate).getTime()
  return Number.isFinite(start) ? start - minutes * 60_000 : null
}

export const getReminderKey = (event: ReminderEvent, reminderTime: number) =>
  `${event.id}-${reminderTime}`

export function reminderDeadline(event: ReminderEvent, reminderTime: number) {
  return Math.max(
    new Date(event.startDate).getTime(),
    reminderTime + CATCH_UP_FLOOR_MS,
  )
}

export function isReminderDue(event: ReminderEvent, now: number): boolean {
  const due = getReminderTime(event)
  return due !== null && due <= now && now < reminderDeadline(event, due)
}
