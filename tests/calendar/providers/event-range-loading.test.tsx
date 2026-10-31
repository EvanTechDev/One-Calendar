import { mock as moduleMock, setSystemTime } from 'bun:test'
const { stubGlobal, unstubAllGlobals } = await import('./../../support/stubs')
await import('./../../support/dom')
const { act, cleanup, render, screen, waitFor } =
  await import('@testing-library/react')
import { afterEach, beforeEach, expect, it, vi } from 'bun:test'
const { SWRConfig } = await import('swr')

const mock = (() => ({
  list: vi.fn(),
  delete: vi.fn(),
  idle: new Map<number, () => void>(),
  nextIdle: 0,
}))()
moduleMock.module('@zntr/calendar/lib/api-client', () => ({
  api: {
    events: { list: mock.list, delete: mock.delete },
    categories: { list: async () => ({ categories: [] }) },
    countdowns: { list: async () => ({ countdowns: [] }) },
    bookmarks: { list: async () => ({ bookmarks: [] }) },
    settings: { get: async () => ({ settings: { language: 'en' } }) },
  },
}))
const { DataProvider, useData } =
  await import('@zntr/calendar/components/providers/data-provider')

const { calendarLoadRange, calendarVisibleRange, calendarPreloadRange } =
  await import('@zntr/calendar/lib/calendar-range')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  setSystemTime(new Date('2026-10-05T12:00:00Z'))
  mock.list.mockReset()
  mock.delete.mockReset()
  mock.idle.clear()
  mock.nextIdle = 0
  stubGlobal('requestIdleCallback', (callback: () => void) => {
    const id = ++mock.nextIdle
    mock.idle.set(id, callback)
    return id
  })
  stubGlobal('cancelIdleCallback', (id: number) => mock.idle.delete(id))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  unstubAllGlobals()
})

function renderCalendarData() {
  const pending: Array<{
    range: ReturnType<typeof calendarLoadRange>
    resolve: (body: unknown) => void
  }> = []
  mock.list.mockImplementation(
    (range) => new Promise((resolve) => pending.push({ range, resolve })),
  )
  let data!: ReturnType<typeof useData>
  function Probe() {
    data = useData()
    return (
      <output>
        {data.eventsLoading
          ? 'loading'
          : data.events.map((e) => e.id).join(',')}
      </output>
    )
  }
  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        revalidateOnFocus: false,
      }}
    >
      <DataProvider>
        <Probe />
      </DataProvider>
    </SWRConfig>,
  )
  return { pending, data: () => data }
}

it('starts with a 150-per-side batch centered on today and reuses its actual coverage', async () => {
  const { pending, data } = renderCalendarData()
  const initial = pending[0].range
  expect(Date.parse(initial.startDate)).toBeLessThanOrEqual(
    new Date(2026, 9, 1).getTime(),
  )
  expect(Date.parse(initial.endDate)).toBeGreaterThanOrEqual(
    new Date(2026, 10, 1).getTime(),
  )
  expect(
    Date.parse(initial.endDate) - Date.parse(initial.startDate),
  ).toBeLessThan(50 * 86400000)
  expect(mock.list.mock.calls[0][0]).toMatchObject({
    batchSize: 150,
    anchorDate: '2026-10-05T12:00:00.000Z',
  })
  const coverage = calendarPreloadRange(
    calendarLoadRange(new Date(2026, 9, 5), 'month', initial.timezone),
  )
  await act(async () =>
    pending[0].resolve({
      events: [{ id: 'preloaded' }],
      coverage,
      batchSize: 400,
    }),
  )

  for (const [year, month, view] of [
    [2026, 10, 'month'],
    [2026, 11, 'month'],
  ] as const) {
    await act(async () =>
      data().setEventsRange(
        calendarLoadRange(new Date(year, month, 4), view, initial.timezone),
      ),
    )
  }
  expect(mock.list).toHaveBeenCalledTimes(1)
  expect(screen.getByText('preloaded')).toBeInTheDocument()
  await act(async () =>
    data().setEventsRange(
      calendarLoadRange(new Date(2026, 6, 4), 'year', initial.timezone),
    ),
  )
  expect(mock.list).toHaveBeenCalledTimes(2)
  expect(Date.parse(pending[1].range.startDate)).toBeLessThanOrEqual(
    new Date(2025, 11, 1).getTime(),
  )
  expect(Date.parse(pending[1].range.endDate)).toBeGreaterThanOrEqual(
    new Date(2027, 1, 1).getTime(),
  )
  expect(
    Date.parse(pending[1].range.endDate) -
      Date.parse(pending[1].range.startDate),
  ).toBeLessThan(440 * 86400000)
})

it('loads uncovered periods and never lets an old range response overwrite a newer one', async () => {
  const { pending, data } = renderCalendarData()
  const older = calendarLoadRange(new Date(2035, 1, 4), 'month', 'UTC')
  const newer = calendarLoadRange(
    new Date(2040, 7, 4),
    'year',
    'America/New_York',
  )
  await act(async () => data().setEventsRange(older))
  await waitFor(() => expect(pending).toHaveLength(2))
  await act(async () => data().setEventsRange(newer))
  await waitFor(() => expect(pending).toHaveLength(3))
  expect(Date.parse(pending[2].range.startDate)).toBeLessThanOrEqual(
    Date.parse(newer.startDate),
  )
  expect(Date.parse(pending[2].range.endDate)).toBeGreaterThanOrEqual(
    Date.parse(newer.endDate),
  )
  await act(async () => pending[2].resolve({ events: [{ id: 'newer' }] }))
  expect(screen.getByText('newer')).toBeInTheDocument()
  await act(async () => pending[1].resolve({ events: [{ id: 'older' }] }))
  expect(screen.queryByText('older')).not.toBeInTheDocument()
  expect(screen.getByText('newer')).toBeInTheDocument()
  // Returning to a previously fetched window paints its cached rows immediately.
  await act(async () => data().setEventsRange(older))
  expect(screen.getByText('older')).toBeInTheDocument()
})

it('starts a separate request when the timezone changes within the same dates', async () => {
  const { pending, data } = renderCalendarData()
  const timezone = 'Pacific/Kiritimati'
  await act(async () =>
    data().setEventsRange(
      calendarLoadRange(new Date(2026, 10, 4), 'month', timezone),
    ),
  )
  expect(pending).toHaveLength(2)
  expect(pending[1].range.timezone).toBe(timezone)
  await act(async () => pending[1].resolve({ events: [{ id: 'new-zone' }] }))
  await act(async () => pending[0].resolve({ events: [{ id: 'old-zone' }] }))
  expect(screen.getByText('new-zone')).toBeInTheDocument()
  expect(screen.queryByText('old-zone')).not.toBeInTheDocument()
})

it('invalidates previously visited windows after a deletion instead of restoring stale cached events', async () => {
  const { pending, data } = renderCalendarData()
  const initial = pending[0].range
  await act(async () => pending[0].resolve({ events: [{ id: 'deleted' }] }))
  await act(async () =>
    data().setEventsRange(
      calendarLoadRange(new Date(2040, 5, 4), 'month', initial.timezone),
    ),
  )
  await act(async () => pending[1].resolve({ events: [] }))
  mock.delete.mockResolvedValue({ success: true })
  let deleting!: Promise<void>
  await act(async () => {
    deleting = data().deleteEvent('deleted')
  })
  await waitFor(() => expect(pending).toHaveLength(3))
  await act(async () => {
    pending[2].resolve({ events: [] })
    await deleting
  })
  await act(async () =>
    data().setEventsRange(
      calendarVisibleRange(new Date(2026, 9, 5), 'month', initial.timezone),
    ),
  )
  expect(data().events).toEqual([])
  expect(pending).toHaveLength(4)
  expect(pending[3].range).toEqual(initial)
  await act(async () => pending[3].resolve({ events: [] }))
  expect(data().events).toEqual([])
})

it('keeps displayed data during refresh and resolves only after revalidation', async () => {
  const { pending, data } = renderCalendarData()
  await act(async () => pending[0].resolve({ events: [{ id: 'visible' }] }))
  let finished = false
  let refreshing!: Promise<void>
  await act(async () => {
    refreshing = data()
      .refreshEvents()
      .then(() => {
        finished = true
      })
  })
  expect(pending).toHaveLength(2)
  expect(screen.getByText('visible')).toBeInTheDocument()
  expect(finished).toBe(false)
  await act(async () => {
    pending[1].resolve({ events: [{ id: 'fresh' }] })
    await refreshing
  })
  expect(finished).toBe(true)
  expect(screen.getByText('fresh')).toBeInTheDocument()
})

it('extends 150 to 400 per side in the background and reuses the merged coverage without a loading gap', async () => {
  const { pending, data } = renderCalendarData()
  expect(mock.idle.size).toBe(0)
  const initialCoverage = {
    startDate: '2026-08-01T00:00:00Z',
    endDate: '2027-02-01T00:00:00Z',
    timezone: pending[0].range.timezone,
  }
  await act(async () =>
    pending[0].resolve({
      events: [{ id: 'current' }, { id: 'revoked' }],
      coverage: initialCoverage,
      batchSize: 150,
    }),
  )
  expect(pending).toHaveLength(1)
  await act(async () => {
    const callbacks = [...mock.idle.values()]
    mock.idle.clear()
    callbacks.forEach((callback) => callback())
  })
  expect(pending).toHaveLength(2)
  expect(mock.list.mock.calls[1][0]).toMatchObject({
    batchSize: 400,
    excludeStartDate: initialCoverage.startDate,
    excludeEndDate: initialCoverage.endDate,
  })
  expect(screen.getByText('current,revoked')).toBeInTheDocument()
  expect(data().eventsLoading).toBe(false)
  const fullCoverage = {
    ...initialCoverage,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2027-10-01T00:00:00Z',
  }
  await act(async () => {
    pending[1].resolve({
      events: [{ id: 'more' }],
      retainedIds: ['current'],
      coverage: fullCoverage,
      batchSize: 400,
    })
  })
  expect(screen.getByText('current,more')).toBeInTheDocument()
  expect(pending).toHaveLength(2)
  await act(async () =>
    data().setEventsRange(
      calendarVisibleRange(
        new Date(2027, 2, 4),
        'month',
        pending[0].range.timezone,
      ),
    ),
  )
  expect(data().eventsLoading).toBe(false)
  expect(screen.getByText('current,more')).toBeInTheDocument()
  expect(pending).toHaveLength(2)
  // Refresh keeps the enlarged batch, instead of shrinking back to 150.
  let refreshing!: Promise<void>
  await act(async () => {
    refreshing = data().refreshEvents()
  })
  expect(mock.list.mock.calls[2][0].batchSize).toBe(400)
  await act(async () =>
    data().setEventsRange(
      calendarVisibleRange(
        new Date(2026, 6, 4),
        'month',
        pending[0].range.timezone,
      ),
    ),
  )
  expect(data().eventsLoading).toBe(false)
  await act(async () => {
    pending[2].resolve({
      events: [{ id: 'fresh' }],
      coverage: fullCoverage,
      batchSize: 400,
    })
    await refreshing
  })
  expect(screen.getByText('fresh')).toBeInTheDocument()
  expect(pending).toHaveLength(3)
})

it.each(['delete', 'refresh'] as const)(
  'keeps a newer %s when an older background batch finishes',
  async (action) => {
    const { pending, data } = renderCalendarData()
    mock.delete.mockResolvedValue({ success: true })
    const coverage = { ...pending[0].range }
    await act(async () =>
      pending[0].resolve({
        events: [{ id: 'deleted' }],
        coverage,
        batchSize: 150,
      }),
    )
    await act(async () => {
      const callbacks = [...mock.idle.values()]
      mock.idle.clear()
      callbacks.forEach((callback) => callback())
    })
    expect(pending).toHaveLength(2)
    let refreshing: Promise<void> | undefined
    await act(async () => {
      if (action === 'delete') await data().deleteEvent('deleted')
      else refreshing = data().refreshEvents()
    })
    if (action === 'delete') expect(data().events).toEqual([])
    // The authoritative post-write request wins over the older background data.
    expect(pending).toHaveLength(3)
    await act(async () => {
      pending[2].resolve({
        events: [],
        coverage,
        batchSize: 150,
        complete: true,
      })
      await refreshing
    })
    await act(async () =>
      pending[1].resolve({
        events: [{ id: 'deleted' }],
        coverage,
        batchSize: 400,
      }),
    )
    expect(data().events).toEqual([])
    expect(data().eventsRange).toMatchObject(coverage)
  },
)
