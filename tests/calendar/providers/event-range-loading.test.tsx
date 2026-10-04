import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SWRConfig } from 'swr'
import { DataProvider, useData } from '@/components/providers/data-provider'
import { calendarLoadRange } from '@/lib/calendar-range'

const mock = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/lib/api-client', () => ({
  api: {
    events: { list: mock.list },
    categories: { list: async () => ({ categories: [] }) },
    countdowns: { list: async () => ({ countdowns: [] }) },
    bookmarks: { list: async () => ({ bookmarks: [] }) },
    settings: { get: async () => ({ settings: { language: 'en' } }) },
  },
}))
afterEach(cleanup)
it('fetches new visible periods and never lets an old range response overwrite a newer one', async () => {
  const resolve = new Map<string, (body: unknown) => void>()
  mock.list.mockImplementation(
    (range) => new Promise((done) => resolve.set(range.startDate, done)),
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
  const older = calendarLoadRange(new Date(2035, 1, 4), 'month', 'UTC')
  const newer = calendarLoadRange(
    new Date(2040, 7, 4),
    'year',
    'America/New_York',
  )
  await act(async () => data.setEventsRange(older))
  await waitFor(() => expect(mock.list).toHaveBeenCalledWith(older))
  await act(async () => data.setEventsRange(newer))
  await waitFor(() => expect(mock.list).toHaveBeenCalledWith(newer))
  await act(async () =>
    resolve.get(newer.startDate)!({ events: [{ id: 'newer' }] }),
  )
  expect(screen.getByText('newer')).toBeInTheDocument()
  await act(async () =>
    resolve.get(older.startDate)!({ events: [{ id: 'older' }] }),
  )
  expect(screen.queryByText('older')).not.toBeInTheDocument()
  expect(screen.getByText('newer')).toBeInTheDocument()
  expect(Date.parse(newer.endDate) - Date.parse(newer.startDate)).toBeLessThan(
    550 * 86400000,
  )
})
