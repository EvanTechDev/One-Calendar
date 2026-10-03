/**
 * Named time ranges ("today", "next_week", …) resolved to concrete
 * start/end instants in the user's timezone.
 *
 * This module is the ONE owner of the preset vocabulary. It exists because
 * Groq validates tool arguments server-side against the JSON schema and a
 * model that invents a preset ("tomorrow" was not in the original enum)
 * used to kill the whole stream with a 400. The tool schema now accepts any
 * string and resolves it here — an unknown preset becomes an error RESULT
 * the model can read and correct, never a dead stream.
 *
 * Pure and dependency-free (same DST caveat as scheduling.ts: the timezone
 * offset is sampled once at `now`).
 */
import { timezoneOffsetMs } from './scheduling'

const DAY = 86_400_000

export const PRESET_NAMES = [
  'today',
  'tomorrow',
  'yesterday',
  'this_week',
  'next_week',
  'last_week',
  'this_month',
  'next_month',
  'last_month',
  'this_year',
  'last_year',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'upcoming',
  'past',
] as const

export type CalendarPreset = (typeof PRESET_NAMES)[number]

/**
 * Synonyms models actually produce, mapped onto the canonical names.
 *
 * The rolling-window and calendar-year presets are here for the palette's
 * semantic search, which asks "去年和 Alex 讨论项目的会议" and "我最近一次去医院
 * 是什么时候" — but they live in this module, not in the search prompt, so the
 * chat tool and the search resolve the same word to the same range.
 */
const ALIASES: Record<string, CalendarPreset> = {
  week: 'this_week',
  month: 'this_month',
  year: 'this_year',
  current_week: 'this_week',
  current_month: 'this_month',
  current_year: 'this_year',
  future: 'upcoming',
  previous_week: 'last_week',
  previous_month: 'last_month',
  previous_year: 'last_year',
  recent: 'last_30_days',
  recently: 'last_30_days',
  lately: 'last_30_days',
  last_week_7_days: 'last_7_days',
  past_7_days: 'last_7_days',
  past_30_days: 'last_30_days',
  past_90_days: 'last_90_days',
  past_3_months: 'last_90_days',
  past_year: 'last_year',
  ytd: 'this_year',
  year_to_date: 'this_year',
}

export function normalizePreset(value: string): CalendarPreset | null {
  const key = value.trim().toLowerCase().replaceAll('-', '_')
  if ((PRESET_NAMES as readonly string[]).includes(key)) {
    return key as CalendarPreset
  }
  return ALIASES[key] ?? null
}

export interface ResolvedPresetRange {
  /** ISO instant; absent for open-ended ranges (`past`). */
  start?: string
  /** ISO instant; absent for open-ended ranges (`upcoming`). */
  end?: string
}

/**
 * Resolves a preset to UTC instants. Day/week/month boundaries are the
 * user's local wall-clock boundaries; weeks start on Monday (matching the
 * analytics engine's weekday convention).
 */
export function resolvePreset(
  preset: CalendarPreset,
  now: Date,
  timeZone: string,
): ResolvedPresetRange {
  const offset = timezoneOffsetMs(now, timeZone)
  const localNow = now.getTime() + offset
  const dayStart = Math.floor(localNow / DAY) * DAY
  const toIso = (localMs: number) => new Date(localMs - offset).toISOString()

  // Monday-based: epoch day 0 (1970-01-01) was a Thursday, so +3 days
  // aligns the modulo to Monday.
  const weekday = (Math.floor(localNow / DAY) + 3) % 7
  const weekStart = dayStart - weekday * DAY

  const local = new Date(localNow)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()

  switch (preset) {
    case 'today':
      return { start: toIso(dayStart), end: toIso(dayStart + DAY) }
    case 'tomorrow':
      return { start: toIso(dayStart + DAY), end: toIso(dayStart + 2 * DAY) }
    case 'yesterday':
      return { start: toIso(dayStart - DAY), end: toIso(dayStart) }
    case 'this_week':
      return { start: toIso(weekStart), end: toIso(weekStart + 7 * DAY) }
    case 'next_week':
      return {
        start: toIso(weekStart + 7 * DAY),
        end: toIso(weekStart + 14 * DAY),
      }
    case 'last_week':
      return { start: toIso(weekStart - 7 * DAY), end: toIso(weekStart) }
    case 'this_month':
      return {
        start: toIso(Date.UTC(y, m, 1)),
        end: toIso(Date.UTC(y, m + 1, 1)),
      }
    case 'next_month':
      return {
        start: toIso(Date.UTC(y, m + 1, 1)),
        end: toIso(Date.UTC(y, m + 2, 1)),
      }
    case 'last_month':
      return {
        start: toIso(Date.UTC(y, m - 1, 1)),
        end: toIso(Date.UTC(y, m, 1)),
      }
    case 'this_year':
      return {
        start: toIso(Date.UTC(y, 0, 1)),
        end: toIso(Date.UTC(y + 1, 0, 1)),
      }
    case 'last_year':
      return {
        start: toIso(Date.UTC(y - 1, 0, 1)),
        end: toIso(Date.UTC(y, 0, 1)),
      }
    // Rolling windows, not calendar windows: "recently" means the last N days,
    // counted back from now, and the end is now rather than the end of today —
    // a search for "the last time I was at the clinic" does not care what
    // happens later today.
    case 'last_7_days':
      return { start: toIso(localNow - 7 * DAY), end: now.toISOString() }
    case 'last_30_days':
      return { start: toIso(localNow - 30 * DAY), end: now.toISOString() }
    case 'last_90_days':
      return { start: toIso(localNow - 90 * DAY), end: now.toISOString() }
    case 'upcoming':
      return { start: now.toISOString() }
    case 'past':
      return { end: now.toISOString() }
  }
}
