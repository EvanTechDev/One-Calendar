import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { SWRConfig, useSWRConfig } from 'swr'
import { DataProvider, useData } from '@/components/providers/data-provider'
import {
  CalendarProvider,
  useCalendar,
} from '@/components/providers/calendar-context'
import type { CalendarEvent } from '@/components/providers/calendar-context'
import type { api, EventData } from '@/lib/api-client'

/**
 * Regression tests for the "this and following" split ghost: after saving a
 * recurring event with apply_to=following, the truncated old series must not
 * linger in the client cache (it disappeared only after a page refresh).
 * The worst case is a root-instance split where the old series expands to
 * zero in-window instances, so the response payload carries no trace of it.
 */

type Resolver = (value: {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}) => void

// FIFO list (not a Map keyed by url): concurrent requests can share the same
// url (e.g. two overlapping POST /api/events) and must be resolvable in order.
let pending: { key: string; resolve: Resolver }[] = []

const resolveJson = (url: string, body: unknown) => {
  const idx = pending.findIndex(
    (p) => p.key === url || p.key.startsWith(`${url}?`),
  )
  if (idx < 0) throw new Error(`no pending fetch for ${url}`)
  const [entry] = pending.splice(idx, 1)
  entry.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  })
}

const pendingExact = (url: string) =>
  pending.filter((p) => p.key === url).map((p) => p.key)

const weeklyRule = 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO'

let eventSeq = 0
function evt(overrides: Partial<EventData> = {}): EventData {
  eventSeq += 1
  return {
    id: `evt-${eventSeq}`,
    userId: 'u1',
    title: 'Standup',
    description: null,
    location: null,
    startDate: '2026-08-10T09:00:00.000Z',
    endDate: '2026-08-10T09:30:00.000Z',
    isAllDay: false,
    color: null,
    categoryId: null,
    participants: null,
    notificationMinutes: null,
    rrule: null,
    exdate: null,
    seriesId: null,
    recurrenceId: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function instance(
  seriesId: string,
  stamp: string,
  start: string,
  extra: Partial<EventData> = {},
): EventData {
  return evt({
    id: `${seriesId}_${stamp}`,
    seriesId,
    recurrenceId: stamp,
    rrule: weeklyRule,
    startDate: start,
    endDate: new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString(),
    ...extra,
  })
}

const seedInstances = () => [
  instance('master-1', '20260810T090000Z', '2026-08-10T09:00:00.000Z'),
  instance('master-1', '20260817T090000Z', '2026-08-17T09:00:00.000Z'),
  instance('master-1', '20260824T090000Z', '2026-08-24T09:00:00.000Z'),
]

const newSeriesInstances = (masterId: string) => [
  instance(masterId, '20260810T110000Z', '2026-08-10T11:00:00.000Z'),
  instance(masterId, '20260817T110000Z', '2026-08-17T11:00:00.000Z'),
]

const rawNewMaster = (id: string): EventData =>
  evt({
    id,
    rrule: weeklyRule,
    seriesId: null,
    recurrenceId: null,
    startDate: '2026-08-10T11:00:00.000Z',
    endDate: '2026-08-10T11:30:00.000Z',
  })

let storeEvents: CalendarEvent[] = []
let upsertFn:
  | ((
      data: Parameters<typeof api.events.create>[0],
      oldSeriesIds?: Set<string>,
    ) => Promise<EventData>)
  | null = null
let swrCache: { clear?: () => void } | null = null

function Probe() {
  const { events } = useCalendar()
  const data = useData()
  const { cache } = useSWRConfig()
  swrCache = cache as unknown as { clear?: () => void }
  storeEvents = events
  upsertFn = data.upsertEvent
  return null
}

// NOTE: no custom cache `provider` here on purpose — the app (and the
// global `mutate` used by DataProvider) targets the default global cache,
// exactly like production. The cache is cleared between tests instead.
const renderApp = () =>
  render(
    // dedupingInterval: 0 — the default 2s window would dedupe the initial
    // GETs across tests sharing the global cache and swallow their fetches.
    <SWRConfig value={{ errorRetryCount: 1, dedupingInterval: 0 }}>
      <DataProvider>
        <CalendarProvider>
          <Probe />
        </CalendarProvider>
      </DataProvider>
    </SWRConfig>,
  )

const seedApp = async (events: EventData[]) => {
  renderApp()
  resolveJson('/api/categories', { categories: [] })
  resolveJson('/api/events', { events })
  resolveJson('/api/countdowns', { countdowns: [] })
  resolveJson('/api/bookmarks', { bookmarks: [] })
  resolveJson('/api/settings', { settings: { timezone: 'UTC' } })
  await waitFor(() => {
    expect(storeEvents.length).toBe(events.length)
  })
}

const runUpsert = async (
  payload: Parameters<typeof api.events.create>[0],
  postResponse: unknown,
) => {
  let promise: Promise<EventData> | undefined
  act(() => {
    promise = upsertFn!(payload)
  })
  await waitFor(() => {
    expect(pendingExact('/api/events').length).toBe(1)
  })
  resolveJson('/api/events', postResponse)
  await act(async () => {
    await promise
  })
}

describe('following-split reconciliation (ghost regression)', () => {
  beforeEach(() => {
    pending = []
    storeEvents = []
    upsertFn = null
    swrCache?.clear?.()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (input: RequestInfo | URL) =>
          new Promise((resolve) => {
            pending.push({
              key: String(input),
              resolve: resolve as unknown as Resolver,
            })
          }),
      ),
    )
  })

  afterEach(() => {
    for (const entry of pending) {
      entry.resolve({ ok: true, status: 200, json: async () => ({}) })
    }
    pending = []
    vi.unstubAllGlobals()
  })

  it('purges the old series via removedSeriesIds even when the caller passes no oldSeriesIds', async () => {
    await seedApp(seedInstances())

    // Root-instance split: the truncated old series expands to zero
    // in-window instances, so seriesEvents cannot reveal it.
    await runUpsert(
      {
        id: 'master-1_20260810T090000Z',
        title: 'Standup',
        startDate: '2026-08-10T11:00:00.000Z',
        endDate: '2026-08-10T11:30:00.000Z',
        isAllDay: false,
        rrule: weeklyRule,
        apply_to: 'following',
        split_id: 'new-master-1',
      },
      {
        event: rawNewMaster('new-master-1'),
        seriesEvents: newSeriesInstances('new-master-1'),
        removedSeriesIds: ['master-1'],
      },
    )

    await waitFor(() => {
      expect(storeEvents.some((e) => e.seriesId === 'master-1')).toBe(false)
      expect(storeEvents.some((e) => e.id === 'master-1')).toBe(false)
    })
    expect(
      storeEvents.filter((e) => e.seriesId === 'new-master-1').length,
    ).toBe(2)
  })

  it('derives the old series from the cache when the response has no removedSeriesIds (legacy server)', async () => {
    await seedApp(seedInstances())

    await runUpsert(
      {
        id: 'master-1_20260810T090000Z',
        title: 'Standup',
        startDate: '2026-08-10T11:00:00.000Z',
        endDate: '2026-08-10T11:30:00.000Z',
        isAllDay: false,
        rrule: weeklyRule,
        apply_to: 'following',
        split_id: 'new-master-1',
      },
      {
        event: rawNewMaster('new-master-1'),
        seriesEvents: newSeriesInstances('new-master-1'),
      },
    )

    await waitFor(() => {
      expect(storeEvents.some((e) => e.seriesId === 'master-1')).toBe(false)
    })
    expect(
      storeEvents.filter((e) => e.seriesId === 'new-master-1').length,
    ).toBe(2)
  })

  it('purges a raw master row (shared/unexpanded series) after a following split at the root', async () => {
    const sharedMaster = evt({
      id: 'shared-1',
      rrule: weeklyRule,
      viewOnly: true,
      startDate: '2026-08-10T09:00:00.000Z',
      endDate: '2026-08-10T09:30:00.000Z',
    })
    await seedApp([sharedMaster])

    await runUpsert(
      {
        id: 'shared-1',
        title: 'Standup',
        startDate: '2026-08-10T11:00:00.000Z',
        endDate: '2026-08-10T11:30:00.000Z',
        isAllDay: false,
        rrule: weeklyRule,
        apply_to: 'following',
        split_id: 'new-master-2',
      },
      {
        event: rawNewMaster('new-master-2'),
        seriesEvents: newSeriesInstances('new-master-2'),
      },
    )

    await waitFor(() => {
      expect(storeEvents.some((e) => e.id === 'shared-1')).toBe(false)
    })
    expect(
      storeEvents.filter((e) => e.seriesId === 'new-master-2').length,
    ).toBe(2)
  })

  it('never injects a raw series master into the expanded cache when seriesEvents is empty — revalidates instead', async () => {
    await seedApp(seedInstances())

    // This flow cannot use runUpsert: the fallback's awaited revalidation
    // means the returned promise only settles after we answer the GET below.
    let promise: Promise<EventData> | undefined
    act(() => {
      promise = upsertFn!({
        id: 'master-1_20260810T090000Z',
        title: 'Standup',
        startDate: '2026-08-10T11:00:00.000Z',
        endDate: '2026-08-10T11:30:00.000Z',
        isAllDay: false,
        rrule: weeklyRule,
        apply_to: 'following',
        split_id: 'new-master-1',
      })
    })
    await waitFor(() => {
      expect(pendingExact('/api/events').length).toBe(1)
    })
    // Degenerate response: no seriesEvents at all. The raw master row in
    // `event` must not be upserted into the expanded-view cache.
    resolveJson('/api/events', { event: rawNewMaster('new-master-1') })

    // The fallback must trigger a real revalidation…
    await waitFor(() => {
      expect(
        pending.some(
          (p) => p.key === '/api/events' || p.key.startsWith('/api/events?'),
        ),
      ).toBe(true)
    })
    // …and the store must not contain the raw master row meanwhile.
    expect(storeEvents.some((e) => e.id === 'new-master-1')).toBe(false)

    resolveJson('/api/events', { events: newSeriesInstances('new-master-1') })
    await act(async () => {
      await promise
    })
    await waitFor(() => {
      expect(
        storeEvents.filter((e) => e.seriesId === 'new-master-1').length,
      ).toBe(2)
    })
    expect(storeEvents.some((e) => e.id === 'new-master-1')).toBe(false)
  })

  it('all-scope optimistic honours the split boundary exdate inherited from the clicked instance', async () => {
    // A was already split once: truncated to Aug 10-12 by UNTIL + a boundary
    // exdate on Aug 13. B — the series that split created — owns Aug 13+.
    const untilRule = 'RRULE:FREQ=DAILY;UNTIL=20260813T090000Z'
    const boundary = ['20260813T090000Z']
    const countRule = 'RRULE:FREQ=DAILY;COUNT=3'
    await seedApp([
      instance('master-a', '20260810T090000Z', '2026-08-10T09:00:00.000Z', {
        rrule: untilRule,
        exdate: boundary,
      }),
      instance('master-a', '20260811T090000Z', '2026-08-11T09:00:00.000Z', {
        rrule: untilRule,
        exdate: boundary,
      }),
      instance('master-a', '20260812T090000Z', '2026-08-12T09:00:00.000Z', {
        rrule: untilRule,
        exdate: boundary,
      }),
      instance('master-b', '20260813T110000Z', '2026-08-13T11:00:00.000Z', {
        rrule: countRule,
      }),
      instance('master-b', '20260814T110000Z', '2026-08-14T11:00:00.000Z', {
        rrule: countRule,
      }),
      instance('master-b', '20260815T110000Z', '2026-08-15T11:00:00.000Z', {
        rrule: countRule,
      }),
    ])

    let promise: Promise<EventData> | undefined
    act(() => {
      promise = upsertFn!({
        id: 'master-a_20260812T090000Z',
        title: 'Renamed standup',
        startDate: '2026-08-12T09:00:00.000Z',
        endDate: '2026-08-12T09:30:00.000Z',
        isAllDay: false,
        rrule: untilRule,
        apply_to: 'all',
        timezone: 'UTC',
      })
    })

    // Optimistic pass: UNTIL is inclusive, so without the boundary exdate
    // the truncated series re-expands onto Aug 13 — B's first day.
    await waitFor(() => {
      expect(storeEvents.some((e) => e.title === 'Renamed standup')).toBe(true)
    })
    expect(
      storeEvents.some(
        (e) =>
          e.seriesId === 'master-a' && e.recurrenceId === '20260813T090000Z',
      ),
    ).toBe(false)

    resolveJson('/api/events', {
      event: evt({
        id: 'master-a',
        title: 'Renamed standup',
        rrule: untilRule,
        exdate: boundary,
      }),
      seriesEvents: [
        instance('master-a', '20260810T090000Z', '2026-08-10T09:00:00.000Z', {
          rrule: untilRule,
          exdate: boundary,
          title: 'Renamed standup',
        }),
        instance('master-a', '20260811T090000Z', '2026-08-11T09:00:00.000Z', {
          rrule: untilRule,
          exdate: boundary,
          title: 'Renamed standup',
        }),
        instance('master-a', '20260812T090000Z', '2026-08-12T09:00:00.000Z', {
          rrule: untilRule,
          exdate: boundary,
          title: 'Renamed standup',
        }),
      ],
    })
    await act(async () => {
      await promise
    })

    const aRows = storeEvents.filter((e) => e.seriesId === 'master-a')
    expect(aRows).toHaveLength(3)
    expect(aRows.some((e) => e.recurrenceId === '20260813T090000Z')).toBe(false)
    expect(storeEvents.filter((e) => e.seriesId === 'master-b')).toHaveLength(3)
  })

  it('a second edit fired mid-split cannot expand the old series’ pre-truncation rule', async () => {
    // Race regression: while split #1's POST is still in flight, the cache
    // holds the OLD series' instances carrying the ORIGINAL unbounded rule.
    // An "all events" drag started in that window must still see the
    // truncated series — otherwise the optimistic expansion bleeds copies
    // across every later day (the flashing ghost).
    const daily = 'RRULE:FREQ=DAILY'
    await seedApp([
      instance('master-a', '20260810T090000Z', '2026-08-10T09:00:00.000Z', {
        rrule: daily,
      }),
      instance('master-a', '20260811T090000Z', '2026-08-11T09:00:00.000Z', {
        rrule: daily,
      }),
      instance('master-a', '20260812T090000Z', '2026-08-12T09:00:00.000Z', {
        rrule: daily,
      }),
      instance('master-a', '20260813T090000Z', '2026-08-13T09:00:00.000Z', {
        rrule: daily,
      }),
      instance('master-a', '20260814T090000Z', '2026-08-14T09:00:00.000Z', {
        rrule: daily,
      }),
      instance('master-a', '20260815T090000Z', '2026-08-15T09:00:00.000Z', {
        rrule: daily,
      }),
    ])

    const splitId = '11111111-1111-4111-8111-111111111111'
    let splitPromise: Promise<EventData> | undefined
    act(() => {
      splitPromise = upsertFn!({
        id: 'master-a_20260813T090000Z',
        title: 'Standup',
        startDate: '2026-08-13T11:00:00.000Z',
        endDate: '2026-08-13T11:30:00.000Z',
        isAllDay: false,
        rrule: daily,
        apply_to: 'following',
        split_id: splitId,
        timezone: 'UTC',
      })
    })
    // Split #1's optimistic pass has landed (B visible) but its POST has not.
    await waitFor(() => {
      expect(storeEvents.some((e) => e.seriesId === splitId)).toBe(true)
    })

    // Mid-flight edit #2: drag A's Aug 12 instance to 15:00, scope "all".
    let allPromise: Promise<EventData> | undefined
    act(() => {
      allPromise = upsertFn!({
        id: 'master-a_20260812T090000Z',
        title: 'Standup',
        startDate: '2026-08-12T15:00:00.000Z',
        endDate: '2026-08-12T17:00:00.000Z',
        isAllDay: false,
        apply_to: 'all',
        timezone: 'UTC',
      })
    })
    // startDate may be a Date (optimistic expansion) or an ISO string
    // (server payload) — normalise before comparing.
    const startMs = (e: CalendarEvent) =>
      new Date(e.startDate as unknown as string).getTime()
    await waitFor(() => {
      expect(
        storeEvents.some(
          (e) =>
            e.seriesId === 'master-a' &&
            startMs(e) === Date.parse('2026-08-12T15:00:00.000Z'),
        ),
      ).toBe(true)
    })
    // No A copy may appear on B's days, even transiently.
    expect(
      storeEvents.some(
        (e) =>
          e.seriesId === 'master-a' &&
          startMs(e) >= Date.parse('2026-08-13T00:00:00.000Z'),
      ),
    ).toBe(false)

    // Split #1's server truth: A truncated (UNTIL + boundary exdate), B real.
    const truncatedRule = 'RRULE:FREQ=DAILY;UNTIL=20260813T090000Z'
    const boundary = ['20260813T090000Z']
    resolveJson('/api/events', {
      event: evt({
        id: splitId,
        rrule: 'RRULE:FREQ=DAILY;COUNT=3',
        startDate: '2026-08-13T11:00:00.000Z',
        endDate: '2026-08-13T11:30:00.000Z',
      }),
      seriesEvents: [
        instance('master-a', '20260810T090000Z', '2026-08-10T09:00:00.000Z', {
          rrule: truncatedRule,
          exdate: boundary,
        }),
        instance('master-a', '20260811T090000Z', '2026-08-11T09:00:00.000Z', {
          rrule: truncatedRule,
          exdate: boundary,
        }),
        instance('master-a', '20260812T090000Z', '2026-08-12T09:00:00.000Z', {
          rrule: truncatedRule,
          exdate: boundary,
        }),
        instance(splitId, '20260813T110000Z', '2026-08-13T11:00:00.000Z', {
          rrule: 'RRULE:FREQ=DAILY;COUNT=3',
        }),
        instance(splitId, '20260814T110000Z', '2026-08-14T11:00:00.000Z', {
          rrule: 'RRULE:FREQ=DAILY;COUNT=3',
        }),
        instance(splitId, '20260815T110000Z', '2026-08-15T11:00:00.000Z', {
          rrule: 'RRULE:FREQ=DAILY;COUNT=3',
        }),
      ],
      removedSeriesIds: ['master-a'],
    })

    // Edit #2's server truth: the whole (truncated) series at 15:00.
    resolveJson('/api/events', {
      event: evt({
        id: 'master-a',
        rrule: truncatedRule,
        exdate: ['20260813T150000Z'],
        startDate: '2026-08-10T15:00:00.000Z',
        endDate: '2026-08-10T17:00:00.000Z',
      }),
      seriesEvents: [
        instance('master-a', '20260810T150000Z', '2026-08-10T15:00:00.000Z', {
          rrule: truncatedRule,
          exdate: ['20260813T150000Z'],
          endDate: '2026-08-10T17:00:00.000Z',
        }),
        instance('master-a', '20260811T150000Z', '2026-08-11T15:00:00.000Z', {
          rrule: truncatedRule,
          exdate: ['20260813T150000Z'],
          endDate: '2026-08-11T17:00:00.000Z',
        }),
        instance('master-a', '20260812T150000Z', '2026-08-12T15:00:00.000Z', {
          rrule: truncatedRule,
          exdate: ['20260813T150000Z'],
          endDate: '2026-08-12T17:00:00.000Z',
        }),
      ],
    })
    await act(async () => {
      await splitPromise
      await allPromise
    })

    const aRows = storeEvents.filter((e) => e.seriesId === 'master-a')
    expect(aRows).toHaveLength(3)
    expect(aRows.every((e) => new Date(startMs(e)).getUTCHours() === 15)).toBe(
      true,
    )
    expect(
      storeEvents.some(
        (e) =>
          e.seriesId === 'master-a' &&
          startMs(e) >= Date.parse('2026-08-13T00:00:00.000Z'),
      ),
    ).toBe(false)
    expect(storeEvents.filter((e) => e.seriesId === splitId)).toHaveLength(3)
  })
})
