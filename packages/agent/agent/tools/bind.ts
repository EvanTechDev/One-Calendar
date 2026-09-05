/**
 * Shared binding for the standalone runtime's per-file tool exports.
 *
 * eve discovers one tool per file; each file default-exports one entry of
 * the authored tool set (src/tools.ts) bound to the HTTP toolkit. The
 * binding is lazy and cached: configuration is read once, on first use,
 * and a missing configuration surfaces as a tool error the model can
 * relay — not a crash at import time.
 */
import { buildCalendarTools, type CalendarTools } from '../../src/tools'
import { configFromEnv, createHttpToolkit } from '../../src/http-toolkit'
import type { CalendarToolkit } from '../../src/types'

let cached: CalendarTools | null = null

function unconfigured(): CalendarToolkit {
  const fail = async (): Promise<never> => {
    throw new Error(
      'The standalone calendar agent is not configured: set CALENDAR_BASE_URL and CALENDAR_COOKIE',
    )
  }
  return {
    listEvents: fail,
    createEvent: fail,
    updateEvent: fail,
    deleteEvent: fail,
    listCategories: fail,
    getAnalyticsSummary: fail,
    getTimezone: fail,
    listBookmarks: fail,
    bookmarkEvent: fail,
    removeBookmark: fail,
    listCountdowns: fail,
    createCountdown: fail,
    deleteCountdown: fail,
  }
}

export function boundTools(): CalendarTools {
  if (!cached) {
    const config = configFromEnv()
    cached = buildCalendarTools(
      config ? createHttpToolkit(config) : unconfigured(),
    )
  }
  return cached
}
