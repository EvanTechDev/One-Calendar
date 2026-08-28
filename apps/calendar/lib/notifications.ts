import { toast } from 'sonner'
import { getStoredLanguage, translations } from '@zntr/i18n/calendar'
import type { CalendarEvent } from '@/components/app/calendar'

/**
 * Client-side reminder delivery. There is no server-side path — see
 * ADR-0001 (in-app reminders are client-side only).
 */

/**
 * A reminder stays deliverable from its due time until the event starts, so a
 * missed reminder is caught up on next open only while it still has value. See
 * ADR-0002 (missed reminders are caught up until the event starts).
 *
 * The floor exists for the at-start reminder (`notification === 0`), whose due
 * time equals the event's start: without it that window would be zero-width and
 * such a reminder could never fire at all.
 */
const CATCH_UP_FLOOR_MS = 5 * 60 * 1000

/** Fired records older than this are pruned; nothing can still be due. */
const FIRED_RECORD_TTL_MS = 24 * 60 * 60 * 1000

const FIRED_STORAGE_KEY = 'reminder-fired'

/**
 * Self-hosted, so no external domain and no CSP media-src rule is involved.
 * WAV rather than MP3: it is generated rather than licensed, and 54 KB of
 * uncompressed audio is cheaper than an unclear provenance.
 */
const REMINDER_SOUND_URL = '/sounds/reminder.wav'

type FiredRecord = Record<string, number>

/**
 * Fallback when localStorage is unavailable — private-mode Safari throws on
 * access, and writes throw when the quota is exceeded. Losing dedupe across a
 * reload is much better than throwing out of the reminder path.
 */
let memoryFired: FiredRecord = {}

function readFiredRecord(now: number): FiredRecord {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(FIRED_STORAGE_KEY)
  } catch {
    return prune(memoryFired, now)
  }

  if (!raw) return prune(memoryFired, now)

  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return prune(memoryFired, now)
    }
    const record: FiredRecord = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        record[key] = value
      }
    }
    return prune(record, now)
  } catch {
    return prune(memoryFired, now)
  }
}

function prune(record: FiredRecord, now: number): FiredRecord {
  const kept: FiredRecord = {}
  for (const [key, firedAt] of Object.entries(record)) {
    if (now - firedAt <= FIRED_RECORD_TTL_MS) kept[key] = firedAt
  }
  return kept
}

function writeFiredRecord(record: FiredRecord) {
  memoryFired = record
  try {
    localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Keep the in-memory copy; dedupe degrades to per-session.
  }
}

/**
 * Minutes-before-start as an instant, or null when the event has no reminder.
 * Null `notification` means no reminder; zero means "at the event's start".
 */
export const getReminderTime = (event: CalendarEvent): number | null => {
  if (!event.startDate) return null
  if (event.notification === null || event.notification === undefined) {
    return null
  }
  if (!Number.isFinite(event.notification)) return null
  if (event.notification < 0) return null

  const startTime = new Date(event.startDate).getTime()
  if (Number.isNaN(startTime)) return null

  return startTime - event.notification * 60 * 1000
}

export const getReminderKey = (event: CalendarEvent, reminderTime: number) =>
  `${event.id}-${reminderTime}`

/**
 * True while a reminder is worth delivering: due, and the event either has not
 * started or is still inside the catch-up floor.
 */
export const isReminderDue = (event: CalendarEvent, now: number): boolean => {
  const reminderTime = getReminderTime(event)
  if (reminderTime === null) return false
  if (reminderTime > now) return false

  const startTime = new Date(event.startDate).getTime()
  if (Number.isNaN(startTime)) return false

  const deadline = Math.max(startTime, reminderTime + CATCH_UP_FLOOR_MS)
  return now < deadline
}

/** Due reminders that have not already been delivered. */
export const getPendingEvents = (
  events: CalendarEvent[],
  now: number,
  fired: FiredRecord,
): CalendarEvent[] =>
  events.filter((event) => {
    if (!isReminderDue(event, now)) return false
    const reminderTime = getReminderTime(event)
    if (reminderTime === null) return false
    return !(getReminderKey(event, reminderTime) in fired)
  })

export const checkPendingNotifications = async (events: CalendarEvent[]) => {
  const now = Date.now()
  const fired = readFiredRecord(now)
  const pendingEvents = getPendingEvents(events, now, fired)

  // Nothing to deliver: leave storage alone. Writing the pruned record back on
  // every tick would mean a localStorage write per minute for no reason.
  if (pendingEvents.length === 0) return

  // Record before delivering, so a throw mid-delivery cannot cause a re-fire
  // on the next tick.
  for (const event of pendingEvents) {
    const reminderTime = getReminderTime(event)
    if (reminderTime !== null) fired[getReminderKey(event, reminderTime)] = now
  }
  writeFiredRecord(fired)

  await Promise.all(
    pendingEvents.map(async (event) => {
      playReminderSound()
      await showSystemNotification(event)
      await showToast(event)
    }),
  )
}

/**
 * The sound is always ours. System notifications are created silent, because
 * whether they would chime is up to the OS and undetectable from here — see
 * ADR-0004 (the reminder sound is ours alone).
 */
const playReminderSound = () => {
  try {
    const audio = new Audio(REMINDER_SOUND_URL)
    audio.play().catch(() => {})
  } catch {
    // No audio support; the notification and toast still land.
  }
}

const showToast = async (event: CalendarEvent) => {
  const language = await getStoredLanguage()
  const t = translations[language]
  toast(`${event.title}`, {
    description: event.description || t.noContent,
    // A reminder for something starting now is worth more than four seconds.
    // A Join action belongs here too, but the event objects reaching this
    // function carry no meeting link yet — that needs the events list to
    // resolve meetings in bulk, which is deliberately a separate change.
    duration: 10000,
  })
}

const getServiceWorkerRegistration = async () => {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null

  try {
    return await navigator.serviceWorker.getRegistration()
  } catch {
    return null
  }
}

/**
 * Prompts for notification permission. Call this only from a user gesture —
 * never from the delivery path.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

const showSystemNotification = async (event: CalendarEvent) => {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  // Never prompt here — see requestNotificationPermission.
  if (Notification.permission !== 'granted') return

  const language = await getStoredLanguage()
  const t = translations[language]

  const title = event.title || 'Calendar'
  const body = event.description || t.noContent
  const tag = event.id ? `event-${event.id}` : 'calendar-event'

  const options: NotificationOptions = {
    body,
    tag,
    // `/favicon.ico` was pointed at a file this repo has never contained, so
    // every notification fell back to the browser's generic bell. The light
    // variant is the fixed choice because a notification is drawn by the OS,
    // which does not consult the page's theme.
    icon: '/logo-light.svg',
    badge: '/logo-light.svg',
    silent: true,
  }

  const registration = await getServiceWorkerRegistration()
  if (registration) {
    try {
      await registration.showNotification(title, options)
      return
    } catch {
      // Fall through to the constructor.
    }
  }

  try {
    new Notification(title, options)
  } catch {
    return
  }
}
