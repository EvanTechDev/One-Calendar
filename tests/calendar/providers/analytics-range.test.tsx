import { mock as moduleMock, setSystemTime } from 'bun:test'
await import('./../../support/dom')
const { act, cleanup, fireEvent, render, screen, waitFor } =
  await import('@testing-library/react')
import { afterEach, expect, it, vi } from 'bun:test'
const { SWRConfig } = await import('swr')

const mock = (() => ({ list: vi.fn() }))()
moduleMock.module('@zntr/calendar/lib/api-client', () => ({
  api: {
    events: { list: mock.list },
    categories: { list: async () => ({ categories: [] }) },
    countdowns: { list: async () => ({ countdowns: [] }) },
    bookmarks: { list: async () => ({ bookmarks: [] }) },
    settings: { get: async () => ({ settings: {} }) },
  },
}))
moduleMock.module('@zntr/i18n/calendar', () => ({
  LANGUAGE_STORAGE_KEY: 'zentra-language',
  useLanguage: () => ['en'],
  translations: {
    en: {
      analytics: 'Analytics',
      back: 'Back',
      loadingCalendar: 'Loading',
      aiSearchRetry: 'Retry',
    },
  },
}))
moduleMock.module(
  '@zntr/calendar/components/providers/calendar-context',
  () => ({
    useCalendar: () => ({ calendars: [] }),
    eventDataToCalendarEvent: (event: unknown) => event,
  }),
)
moduleMock.module('@zntr/calendar/components/analytics/time-analytics', () => ({
  default: ({ events }: { events: { id: string }[] }) => (
    <output>
      {events.map((event) => event.id).join(',') || 'Empty report'}
    </output>
  ),
}))
const { DataProvider, useEvents } =
  await import('@zntr/calendar/components/providers/data-provider')

const { default: AnalyticsView } =
  await import('@zntr/calendar/components/analytics/analytics-view')

const { analyticsLoadRange } =
  await import('@zntr/calendar/lib/analytics/load-range')

const { calendarLoadRange, containsCalendarRange } =
  await import('@zntr/calendar/lib/calendar-range')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('loads analytics independently of a distant bookmark, hiding stale and failed reports', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  setSystemTime(new Date('2026-10-05T12:00:00Z'))
  const pending: {
    range: ReturnType<typeof calendarLoadRange>
    resolve: (body: unknown) => void
    reject: (error: Error) => void
  }[] = []
  mock.list.mockImplementation(
    (range) =>
      new Promise((resolve, reject) =>
        pending.push({ range, resolve, reject }),
      ),
  )
  let data!: ReturnType<typeof useEvents>
  function Probe({ analytics }: { analytics: boolean }) {
    data = useEvents()
    return analytics ? (
      <AnalyticsView timezone="Pacific/Kiritimati" onCreateEvent={() => {}} />
    ) : null
  }
  const cache = new Map()
  function Host({ analytics }: { analytics: boolean }) {
    return (
      <SWRConfig
        value={{
          provider: () => cache,
          shouldRetryOnError: false,
          revalidateOnFocus: false,
        }}
      >
        <DataProvider>
          <Probe analytics={analytics} />
        </DataProvider>
      </SWRConfig>
    )
  }
  const { rerender } = render(<Host analytics={false} />)
  await act(async () =>
    data.setEventsRange(
      calendarLoadRange(new Date(2040, 0, 1), 'month', 'UTC'),
    ),
  )
  await act(async () => pending[1].resolve({ events: [{ id: 'distant' }] }))
  rerender(<Host analytics />)
  expect(screen.queryByText('distant')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toBeInTheDocument()
  await waitFor(() => expect(pending).toHaveLength(3))
  expect(
    containsCalendarRange(
      pending[2].range,
      analyticsLoadRange(new Date(), 'Pacific/Kiritimati'),
    ),
  ).toBe(true)
  await act(async () => pending[2].reject(new Error('Offline')))
  expect(screen.getByRole('alert')).toHaveTextContent('Offline')
  expect(screen.queryByText('Empty report')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Retry'))
  await waitFor(() => expect(pending).toHaveLength(4))
  await act(async () => pending[3].resolve({ events: [{ id: 'recent' }] }))
  expect(screen.getByText('recent')).toBeInTheDocument()
})

it('includes the previous quarter at the year boundary and the entire annual heatmap', () => {
  const range = analyticsLoadRange(new Date(2026, 0, 1, 12), 'America/New_York')
  expect(Date.parse(range.startDate)).toBeLessThanOrEqual(
    new Date(2025, 6, 6).getTime(),
  )
  expect(Date.parse(range.endDate)).toBe(new Date(2027, 0, 1).getTime())
  expect(range.timezone).toBe('America/New_York')
})
