import type { CalendarLoadRange } from '../calendar-range'
import { previousRange } from './engine'
import { resolveDateRange } from './utils'

/** The annual heatmap plus both periods of the longest selectable preset. */
export function analyticsLoadRange(
  now: Date,
  timezone: string,
): CalendarLoadRange {
  const comparison = previousRange(resolveDateRange('quarter', now))
  return {
    startDate: new Date(
      Math.min(
        new Date(now.getFullYear(), 0, 1).getTime(),
        comparison.start.getTime(),
      ),
    ).toISOString(),
    endDate: new Date(now.getFullYear() + 1, 0, 1).toISOString(),
    timezone,
  }
}
