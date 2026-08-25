/**
 * The event preview had no meeting display at all (BUG-05): an organiser
 * attached a meeting in the editor, clicked the event, and saw nothing.
 *
 * Two failures pinned here beyond "it renders":
 *
 * 1. The lookup must key on the SERIES master. An expanded occurrence's `id`
 *    is a synthetic `<seriesId>_<stamp>` instance id that no row exists for,
 *    so `GET /api/meetings` 404s on it — and a Series carries its Meeting on
 *    the master anyway (ADR-0019).
 * 2. A participant's copy of an event is view-only, and the lookup requires
 *    ownership. That must render nothing quietly, not raise an error.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { CalendarEvent } from '@/components/app/calendar'

const toasts = { error: vi.fn(), success: vi.fn(), warning: vi.fn() }
vi.mock('sonner', () => ({
  toast: Object.assign((...args: unknown[]) => void args, {
    error: (...args: unknown[]) => toasts.error(...args),
    success: (...args: unknown[]) => toasts.success(...args),
    warning: (...args: unknown[]) => toasts.warning(...args),
  }),
}))

vi.mock('@/components/providers/calendar-context', () => ({
  useCalendar: () => ({ calendars: [], events: [] }),
}))

vi.mock('@/components/providers/data-provider', () => ({
  useBookmarks: () => ({
    bookmarks: [],
    createBookmark: vi.fn(),
    deleteBookmark: vi.fn(),
  }),
}))

vi.mock('@/lib/auth/client', () => ({
  authClient: { useSession: () => ({ data: null }) },
}))

const EventPreview = (await import('@/components/app/event/event-preview'))
  .default

const lookups: string[] = []
let meetingForEvent: Record<string, { id: string; url: string } | null> = {}

beforeEach(() => {
  lookups.length = 0
  meetingForEvent = {}
  toasts.error.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input)
      if (url.startsWith('/api/meetings?')) {
        lookups.push(url)
        const eventId = new URL(url, 'https://cal.test').searchParams.get(
          'eventId',
        )!
        if (!(eventId in meetingForEvent)) {
          return { ok: false, status: 404, json: async () => ({}) }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ meeting: meetingForEvent[eventId] }),
        }
      }
      return { ok: true, status: 200, json: async () => ({}) }
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    title: 'Standup',
    startDate: new Date(2026, 0, 15, 10, 0),
    endDate: new Date(2026, 0, 15, 11, 0),
    isAllDay: false,
    participants: [],
    notification: null,
    description: '',
    color: 'bg-[#E6F6FD]',
    calendarId: 'cal-1',
    location: '',
    ...overrides,
  } as CalendarEvent
}

function renderPreview(event: CalendarEvent) {
  return render(
    <EventPreview
      event={event}
      open
      onOpenChange={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      _onDuplicate={vi.fn()}
      language={'en' as never}
      _timezone="UTC"
    />,
  )
}

describe('event preview meeting row (BUG-05)', () => {
  it('shows the attached meeting code with copy and join', async () => {
    meetingForEvent['evt-1'] = {
      id: 'aaaa-bbbb',
      url: 'https://meet.test/aaaa-bbbb',
    }
    renderPreview(makeEvent())

    expect(await screen.findByText('aaaa-bbbb')).toBeInTheDocument()
    expect(screen.getByLabelText('Copy meeting link')).toBeInTheDocument()
    expect(screen.getByLabelText('Join meeting')).toHaveAttribute(
      'href',
      'https://meet.test/aaaa-bbbb',
    )
  })

  it('looks the meeting up by series master, not the synthetic instance id', async () => {
    meetingForEvent['evt-master'] = {
      id: 'cccc-dddd',
      url: 'https://meet.test/cccc-dddd',
    }
    renderPreview(
      makeEvent({
        id: 'evt-master_20260115T100000Z',
        seriesId: 'evt-master',
        recurrenceId: '20260115T100000Z',
      }),
    )

    expect(await screen.findByText('cccc-dddd')).toBeInTheDocument()
    expect(lookups).toHaveLength(1)
    expect(lookups[0]).toContain('eventId=evt-master')
  })

  it('renders nothing and stays silent for a participant view-only event', async () => {
    renderPreview(makeEvent({ viewOnly: true } as Partial<CalendarEvent>))

    await waitFor(() => expect(screen.getByText('Standup')).toBeInTheDocument())
    expect(lookups).toHaveLength(0)
    expect(toasts.error).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Copy meeting link')).toBeNull()
  })

  it('renders no meeting row when the event has none', async () => {
    meetingForEvent['evt-1'] = null
    renderPreview(makeEvent())

    await waitFor(() => expect(lookups).toHaveLength(1))
    expect(screen.queryByLabelText('Copy meeting link')).toBeNull()
  })
})
