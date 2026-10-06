import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SWRConfig } from 'swr'
import {
  DataProvider,
  useData,
} from '@zntr/ui/calendar/components/providers/data-provider'
import { calendarLoadRange } from '@zntr/ui/calendar/lib/calendar-range'

const mock = vi.hoisted(() => ({ list: vi.fn(), delete: vi.fn() }))
vi.mock('@zntr/ui/calendar/lib/api-client', () => ({
  api: {
    events: { list: mock.list, delete: mock.delete },
    categories: { list: async () => ({ categories: [] }) },
    countdowns: { list: async () => ({ countdowns: [] }) },
    bookmarks: { list: async () => ({ bookmarks: [] }) },
    settings: { get: async () => ({ settings: { language: 'en' } }) },
  },
}))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00Z'))
  mock.list.mockReset()
  mock.delete.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
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

it('shares one four-year request across rapid month and year navigation, including before it resolves', async () => {
  const { pending, data } = renderCalendarData()
  const initial = pending[0].range
  expect(Date.parse(initial.startDate)).toBeLessThanOrEqual(
    new Date(2024, 9, 1).getTime(),
  )
  expect(Date.parse(initial.endDate)).toBeGreaterThanOrEqual(
    new Date(2028, 10, 1).getTime(),
  )

  for (const [year, month, view] of [
    [2026, 10, 'month'],
    [2026, 11, 'month'],
    [2027, 5, 'year'],
    [2025, 3, 'month'],
  ] as const) {
    await act(async () =>
      data().setEventsRange(
        calendarLoadRange(new Date(year, month, 4), view, initial.timezone),
      ),
    )
  }
  expect(mock.list).toHaveBeenCalledTimes(1)
  await act(async () => pending[0].resolve({ events: [{ id: 'preloaded' }] }))
  expect(screen.getByText('preloaded')).toBeInTheDocument()
  await act(async () =>
    data().setEventsRange(
      calendarLoadRange(new Date(2028, 6, 4), 'month', initial.timezone),
    ),
  )
  expect(mock.list).toHaveBeenCalledTimes(1)
  expect(screen.getByText('preloaded')).toBeInTheDocument()
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
      calendarLoadRange(new Date(2026, 10, 4), 'month', initial.timezone),
    ),
  )
  expect(data().events).toEqual([])
  expect(pending).toHaveLength(4)
  expect(pending[3].range).toEqual(initial)
  await act(async () => pending[3].resolve({ events: [] }))
  expect(data().events).toEqual([])
})
