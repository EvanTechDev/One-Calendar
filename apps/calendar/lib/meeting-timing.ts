import type { CalendarEvent } from '@/components/app/calendar'

/**
 * How long before an event starts its meeting counts as imminent. Google turns
 * the Join affordance prominent around this distance out.
 */
const STARTING_SOON_MS = 10 * 60 * 1000

export type MeetingTiming = 'upcoming' | 'soon' | 'live' | 'past'

/**
 * Where an event sits relative to now, for deciding how loudly to offer its
 * meeting.
 *
 * Presentation only, derived from `startDate`/`endDate` — this has nothing to
 * do with reminder delivery (ADR-0001 makes that client-side and one-shot).
 * Callers must recompute it on a tick, not once at mount, or an open tab shows
 * a stale state.
 */
export function meetingTiming(
  event: Pick<CalendarEvent, 'startDate' | 'endDate' | 'isAllDay'>,
  now: number = Date.now(),
): MeetingTiming {
  const start = new Date(event.startDate).getTime()
  const end = new Date(event.endDate).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 'upcoming'

  // An all-day event has no meaningful "starts in 10 minutes"; treating it as
  // live for 24 hours would make its Join button shout all day.
  if (event.isAllDay) {
    return now > end ? 'past' : 'upcoming'
  }

  if (now >= start && now <= end) return 'live'
  if (now > end) return 'past'
  if (start - now <= STARTING_SOON_MS) return 'soon'
  return 'upcoming'
}

/** True when the meeting deserves a primary, unmissable Join action. */
export function isJoinUrgent(timing: MeetingTiming): boolean {
  return timing === 'soon' || timing === 'live'
}
