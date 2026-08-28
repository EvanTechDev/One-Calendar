// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  eventRows: [] as Record<string, unknown>[],
  categoryRows: [] as { id: string; name: string }[],
}))

vi.mock('@/lib/mcp/settings-tools', () => ({
  getSettings: vi.fn(async () => state.settings),
}))

vi.mock('@/lib/drizzle/client', () => {
  // A minimal select-only fake: every query resolves with whichever row set
  // matches the from() table, ignoring where-conditions (tests pre-filter).
  const makeQuery = (rows: unknown[]) => {
    const query = {
      from: (table: { __name?: string } & object) => {
        void table
        return query
      },
      where: async () => rows,
    }
    return query
  }
  return {
    getDb: vi.fn(async () => ({
      select: (projection?: Record<string, unknown>) =>
        projection ? makeQuery(state.categoryRows) : makeQuery(state.eventRows),
    })),
  }
})

import {
  resolveAnalyticsRange,
  getAnalyticsSummary,
  getTimeDistribution,
  getAnalyticsInsights,
} from '@/lib/mcp/analytics-tools'
import { InvalidEventQueryError } from '@/lib/mcp/errors'

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    userId: 'u1',
    title: 'enc',
    description: null,
    location: null,
    startDate: new Date('2025-06-10T10:00:00Z'),
    endDate: new Date('2025-06-10T11:00:00Z'),
    isAllDay: false,
    status: 'confirmed',
    color: null,
    categoryId: 'cat-1',
    participants: null,
    notificationMinutes: null,
    emailReminder: false,
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    createdAt: new Date('2025-06-01T00:00:00Z'),
    updatedAt: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  }
}

beforeEach(() => {
  state.settings = {}
  state.eventRows = []
  state.categoryRows = []
})

describe('resolveAnalyticsRange', () => {
  it('defaults to a 30-day window', async () => {
    const { range } = await resolveAnalyticsRange('u1', {})
    const lengthDays =
      (range.end.getTime() - range.start.getTime()) / 86_400_000
    expect(Math.round(lengthDays)).toBe(30)
  })

  it('rejects days combined with absolute dates', async () => {
    await expect(
      resolveAnalyticsRange('u1', { days: 7, start_date: '2025-06-01' }),
    ).rejects.toBeInstanceOf(InvalidEventQueryError)
  })

  it('rejects a lone start_date', async () => {
    await expect(
      resolveAnalyticsRange('u1', { start_date: '2025-06-01' }),
    ).rejects.toBeInstanceOf(InvalidEventQueryError)
  })

  it('rejects invalid dates and inverted ranges', async () => {
    await expect(
      resolveAnalyticsRange('u1', { start_date: 'nope', end_date: 'never' }),
    ).rejects.toBeInstanceOf(InvalidEventQueryError)
    await expect(
      resolveAnalyticsRange('u1', {
        start_date: '2025-06-10',
        end_date: '2025-06-01',
      }),
    ).rejects.toBeInstanceOf(InvalidEventQueryError)
  })

  it('rejects out-of-bounds day windows', async () => {
    await expect(
      resolveAnalyticsRange('u1', { days: 0 }),
    ).rejects.toBeInstanceOf(InvalidEventQueryError)
    await expect(
      resolveAnalyticsRange('u1', { days: 999 }),
    ).rejects.toBeInstanceOf(InvalidEventQueryError)
  })

  it('rejects absolute ranges longer than a year', async () => {
    await expect(
      resolveAnalyticsRange('u1', {
        start_date: '2024-01-01',
        end_date: '2025-06-01',
      }),
    ).rejects.toBeInstanceOf(InvalidEventQueryError)
  })

  it('uses the user settings timezone by default', async () => {
    state.settings = { timezone: 'Asia/Shanghai' }
    const { timeZone } = await resolveAnalyticsRange('u1', {})
    expect(timeZone).toBe('Asia/Shanghai')
  })

  it('lets an explicit timezone override settings', async () => {
    state.settings = { timezone: 'Asia/Shanghai' }
    const { timeZone } = await resolveAnalyticsRange('u1', {
      timezone: 'Europe/Berlin',
    })
    expect(timeZone).toBe('Europe/Berlin')
  })
})

describe('getAnalyticsSummary', () => {
  it('aggregates plain events without decrypting content', async () => {
    state.eventRows = [
      eventRow(),
      eventRow({
        startDate: new Date('2025-06-10T14:00:00Z'),
        endDate: new Date('2025-06-10T16:00:00Z'),
        categoryId: null,
      }),
    ]
    const result = await getAnalyticsSummary('u1', {
      start_date: '2025-06-01T00:00:00Z',
      end_date: '2025-06-15T00:00:00Z',
      timezone: 'UTC',
      compare_previous_period: false,
    })
    expect(result.totalEvents).toBe(2)
    expect(result.scheduledHours).toBe(3)
    expect(result.busyDays).toBe(1)
    expect(result.byCategory).toHaveLength(2)
    // Encrypted title must never leak into the response.
    expect(JSON.stringify(result)).not.toContain('enc')
  })

  it('expands recurring series into occurrences', async () => {
    state.eventRows = [
      eventRow({
        startDate: new Date('2025-06-02T10:00:00Z'),
        endDate: new Date('2025-06-02T11:00:00Z'),
        rrule: 'FREQ=DAILY;COUNT=5',
      }),
    ]
    const result = await getAnalyticsSummary('u1', {
      start_date: '2025-06-01T00:00:00Z',
      end_date: '2025-06-15T00:00:00Z',
      timezone: 'UTC',
      compare_previous_period: false,
    })
    expect(result.totalEvents).toBe(5)
    expect(result.busyDays).toBe(5)
  })

  it('includes a comparison block by default', async () => {
    state.eventRows = [eventRow()]
    const result = await getAnalyticsSummary('u1', {
      start_date: '2025-06-01T00:00:00Z',
      end_date: '2025-06-15T00:00:00Z',
      timezone: 'UTC',
    })
    expect(result).toHaveProperty('comparison')
    expect(result).toHaveProperty('previousRange')
  })

  it('resolves category names when asked', async () => {
    state.eventRows = [eventRow()]
    state.categoryRows = [{ id: 'cat-1', name: 'Work' }]
    const result = await getAnalyticsSummary('u1', {
      start_date: '2025-06-01T00:00:00Z',
      end_date: '2025-06-15T00:00:00Z',
      timezone: 'UTC',
      compare_previous_period: false,
      include_category_names: true,
    })
    expect(result.byCategory[0]).toMatchObject({
      categoryId: 'cat-1',
      categoryName: 'Work',
    })
  })
})

describe('getTimeDistribution', () => {
  it('returns weekday/hour buckets and the punch card', async () => {
    state.eventRows = [
      // Tuesday June 10, 10:00 UTC
      eventRow(),
      eventRow({
        startDate: new Date('2025-06-10T10:30:00Z'),
        endDate: new Date('2025-06-10T11:00:00Z'),
      }),
    ]
    const result = await getTimeDistribution('u1', {
      start_date: '2025-06-01T00:00:00Z',
      end_date: '2025-06-15T00:00:00Z',
      timezone: 'UTC',
    })
    expect(result.byWeekday[1].count).toBe(2) // Tuesday
    expect(result.byHour[10].count).toBe(2)
    expect(result.punchCard[1][10]).toBe(2)
    expect(result.peakWindow?.startHour).toBeDefined()
    expect(result.timezone).toBe('UTC')
  })
})

describe('getAnalyticsInsights', () => {
  it('surfaces overload warnings from raw rows', async () => {
    state.eventRows = [
      eventRow({
        startDate: new Date('2025-06-10T08:00:00Z'),
        endDate: new Date('2025-06-10T18:00:00Z'),
      }),
    ]
    const result = await getAnalyticsInsights('u1', {
      start_date: '2025-06-01T00:00:00Z',
      end_date: '2025-06-15T00:00:00Z',
      timezone: 'UTC',
    })
    expect(
      result.insights.find((i) => i.type === 'overloaded_days'),
    ).toBeDefined()
  })
})
