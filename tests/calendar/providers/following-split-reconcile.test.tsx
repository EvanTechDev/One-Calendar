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

let pending = new Map<string, Resolver>()

const resolveJson = (url: string, body: unknown) => {
  const keys = [...pending.keys()]
  const key = keys.find((k) => k === url || k.startsWith(`${url}?`))
  if (!key) throw new Error(`no pending fetch for ${url}`)
  pending.get(key)!({
    ok: true,
    status: 200,
    json: async () => body,
  })
  pending.delete(key)
}

const pendingExact = (url: string) =>
  [...pending.keys()].filter((k) => k === url)

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
    pending = new Map()
    storeEvents = []
    upsertFn = null
    swrCache?.clear?.()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (input: RequestInfo | URL) =>
          new Promise((resolve) => {
            pending.set(String(input), resolve as unknown as Resolver)
          }),
      ),
    )
  })

  afterEach(() => {
    for (const [url, resolve] of pending) {
      resolve({ ok: true, status: 200, json: async () => ({}) })
      pending.delete(url)
    }
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
        [...pending.keys()].some(
          (k) => k === '/api/events' || k.startsWith('/api/events?'),
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
})
