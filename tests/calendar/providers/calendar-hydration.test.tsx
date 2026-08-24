import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import {
  DataProvider,
  useCountdowns,
} from '@/components/providers/data-provider'
import {
  CalendarProvider,
  useCalendar,
} from '@/components/providers/calendar-context'
import { useEffect } from 'react'

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

const resetStore = () => {
  function Reset() {
    const { setEvents, setCalendars } = useCalendar()
    useEffect(() => {
      setEvents([])
      setCalendars([])
    }, [setEvents, setCalendars])
    return null
  }
  return <Reset />
}

function Probe() {
  const { events, calendars } = useCalendar()
  const { countdowns } = useCountdowns()
  return (
    <div>
      <span data-testid="store-events">{events.length}</span>
      <span data-testid="store-calendars">{calendars.length}</span>
      <span data-testid="ctx-countdowns">{countdowns.length}</span>
    </div>
  )
}

const renderApp = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), errorRetryCount: 1 }}>
      <DataProvider>
        <CalendarProvider>
          {resetStore()}
          <Probe />
        </CalendarProvider>
      </DataProvider>
    </SWRConfig>,
  )

describe('data hydration', () => {
  beforeEach(() => {
    pending = new Map()
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

  it('hydrates the calendar store once events and categories have both arrived', async () => {
    const { getByTestId } = renderApp()

    resolveJson('/api/categories', {
      categories: [
        { id: 'c1', userId: 'u', name: 'Work', color: '#fff', sortOrder: 0 },
      ],
    })

    resolveJson('/api/events', {
      events: [
        {
          id: 'e1',
          userId: 'u',
          title: 'Meeting',
          startDate: '2026-08-05T09:00:00.000Z',
          endDate: '2026-08-05T10:00:00.000Z',
          isAllDay: false,
          color: null,
          categoryId: null,
          participants: null,
          notificationMinutes: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })

    await waitFor(() => {
      expect(getByTestId('store-calendars').textContent).toBe('1')
    })

    await waitFor(() => {
      expect(getByTestId('store-events').textContent).toBe('1')
    })

    resolveJson('/api/countdowns', {
      countdowns: [
        {
          id: 'cd1',
          userId: 'u',
          name: 'Launch',
          targetDate: '2026-12-01T00:00:00.000Z',
          repeat: 'none',
          description: null,
          color: null,
          icon: null,
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    resolveJson('/api/bookmarks', { bookmarks: [] })
    resolveJson('/api/settings', { settings: {} })

    await waitFor(() => {
      expect(getByTestId('ctx-countdowns').textContent).toBe('1')
    })
  })
})
