import { MAX_SCHEDULE_AHEAD_MS } from '@/lib/email/send-scheduled-email'

/**
 * Which reminder emails should be scheduled, and whether the daily quota allows
 * it. The arithmetic is pure so it can be tested without a database or a
 * network — see ADR-0010 (email reminders are opt-in per event and scheduled through Resend).
 */

/** Scheduled sends one user may accumulate against a single calendar day. */
export const DAILY_SEND_QUOTA = 5

export class SendQuotaExceeded extends Error {
  constructor(public readonly dueDate: string) {
    super(
      `You can schedule up to ${DAILY_SEND_QUOTA} reminder emails per day (${dueDate} is full)`,
    )
  }
}

export interface ReminderCandidate {
  eventId: string
  /** Null for a non-recurring event. */
  recurrenceId: string | null
  dueAt: Date
  /** `dueAt` as a date in the user's timezone — the quota's accounting key. */
  dueDate: string
}

export interface OccurrenceInput {
  eventId: string
  recurrenceId: string | null
  startDate: Date
}

/**
 * `date` as YYYY-MM-DD in `timeZone`.
 *
 * The quota is per calendar day where the user lives, so it must not shift when
 * they travel — which is also why the result is stored rather than recomputed.
 */
export function dueDateIn(date: Date, timeZone?: string): string {
  if (!timeZone) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
      date.getUTCDate(),
    )}`
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  // en-CA already yields YYYY-MM-DD.
  return parts
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** The reminder time for an occurrence, or null when it has no reminder. */
export function reminderTimeFor(
  occurrence: OccurrenceInput,
  notificationMinutes: number | null,
): Date | null {
  if (notificationMinutes === null) return null
  if (!Number.isFinite(notificationMinutes)) return null
  if (notificationMinutes < 0) return null
  const start = occurrence.startDate.getTime()
  if (Number.isNaN(start)) return null
  return new Date(start - notificationMinutes * 60_000)
}

/**
 * True while a reminder time can be handed to the provider: in the future, and
 * inside the provider's horizon.
 *
 * Strictly inside — scheduling something 30 days and a minute out would be
 * rejected by the provider rather than clamped.
 */
export function isSchedulable(dueAt: Date, now: Date): boolean {
  const delta = dueAt.getTime() - now.getTime()
  return delta > 0 && delta <= MAX_SCHEDULE_AHEAD_MS
}

/**
 * Occurrences whose reminder should be scheduled now: eligible, in the window,
 * and not already scheduled.
 */
export function candidatesFor(params: {
  occurrences: OccurrenceInput[]
  notificationMinutes: number | null
  emailReminder: boolean
  now: Date
  timeZone?: string
  /** Keys (`eventId` + stamp) that already have a scheduled send. */
  alreadyScheduled: ReadonlySet<string>
}): ReminderCandidate[] {
  const {
    occurrences,
    notificationMinutes,
    emailReminder,
    now,
    timeZone,
    alreadyScheduled,
  } = params

  if (!emailReminder || notificationMinutes === null) return []

  const out: ReminderCandidate[] = []
  for (const occurrence of occurrences) {
    const dueAt = reminderTimeFor(occurrence, notificationMinutes)
    if (dueAt === null || !isSchedulable(dueAt, now)) continue
    if (alreadyScheduled.has(scheduleKey(occurrence))) continue
    out.push({
      eventId: occurrence.eventId,
      recurrenceId: occurrence.recurrenceId,
      dueAt,
      dueDate: dueDateIn(dueAt, timeZone),
    })
  }
  // Earliest first, so a quota cut keeps the soonest reminders.
  return out.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
}

export function scheduleKey(occurrence: {
  eventId: string
  recurrenceId: string | null
}): string {
  return `${occurrence.eventId}|${occurrence.recurrenceId ?? ''}`
}

/**
 * Splits candidates into those the quota admits and those it does not.
 *
 * Enforced at schedule time rather than send time because our code is not
 * running when the provider sends. Counting by target date is what makes a
 * per-day limit meaningful for sends that may be weeks out.
 */
export function applyQuota(params: {
  candidates: ReminderCandidate[]
  /** Existing unsent-or-sent counts per due date for this user. */
  usedByDate: ReadonlyMap<string, number>
  quota?: number
}): { allowed: ReminderCandidate[]; refused: ReminderCandidate[] } {
  const quota = params.quota ?? DAILY_SEND_QUOTA
  const used = new Map(params.usedByDate)
  const allowed: ReminderCandidate[] = []
  const refused: ReminderCandidate[] = []

  for (const candidate of params.candidates) {
    const count = used.get(candidate.dueDate) ?? 0
    if (count >= quota) {
      refused.push(candidate)
      continue
    }
    used.set(candidate.dueDate, count + 1)
    allowed.push(candidate)
  }

  return { allowed, refused }
}
