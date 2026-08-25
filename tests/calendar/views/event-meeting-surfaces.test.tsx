/**
 * The event preview's meeting row.
 *
 * Originally there was no meeting display here at all (BUG-05): an organiser
 * attached a meeting in the editor, clicked the event, and saw nothing. Then it
 * was added as a per-preview `GET /api/meetings?eventId=` fired from an effect,
 * which produced two further complaints — the code appeared a beat after the
 * rest of the popover, and right after a save it did not appear at all until a
 * manual refresh, because the popover reads the SWR-cached event list and that
 * cache had no notion a meeting existed.
 *
 * So the meeting now RIDES ALONG with the event (see `meetingsForEvents` in
 * app/api/events/route.ts). Pinned here:
 *
 * 1. No request is made from this surface, on any event. A round trip removed
 *    is a round trip that cannot be stale or slow.
 * 2. A participant's view-only copy shows nothing and stays silent.
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

const requests: string[] = []

beforeEach(() => {
  requests.length = 0
  toasts.error.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      requests.push(String(input))
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

/** Requests aimed at the meeting lookup this surface must no longer make. */
const meetingLookups = () =>
  requests.filter((url) => url.includes('/api/meetings'))

describe('event preview meeting row', () => {
  it('shows the attached meeting code with copy and join', async () => {
    renderPreview(
      makeEvent({
        meeting: { id: 'aaaa-bbbb', url: 'https://meet.test/aaaa-bbbb' },
      }),
    )

    expect(await screen.findByText('aaaa-bbbb')).toBeInTheDocument()
    expect(screen.getByLabelText('Copy meeting link')).toBeInTheDocument()
    expect(screen.getByLabelText('Join meeting')).toHaveAttribute(
      'href',
      'https://meet.test/aaaa-bbbb',
    )
  })

  it('makes no meeting request at all — the link came with the event', async () => {
    renderPreview(
      makeEvent({
        meeting: { id: 'aaaa-bbbb', url: 'https://meet.test/aaaa-bbbb' },
      }),
    )

    expect(await screen.findByText('aaaa-bbbb')).toBeInTheDocument()
    expect(meetingLookups()).toHaveLength(0)
  })

  it('shows a series occurrence the master\u2019s meeting without a lookup', async () => {
    // A Series carries its Meeting on the master (ADR-0019) and an expanded
    // occurrence's id is a synthetic `<seriesId>_<stamp>` no row exists for.
    // Resolving on the server means this surface never has to know that.
    renderPreview(
      makeEvent({
        id: 'evt-master_20260115T100000Z',
        seriesId: 'evt-master',
        recurrenceId: '20260115T100000Z',
        meeting: { id: 'cccc-dddd', url: 'https://meet.test/cccc-dddd' },
      }),
    )

    expect(await screen.findByText('cccc-dddd')).toBeInTheDocument()
    expect(meetingLookups()).toHaveLength(0)
  })

  it('renders nothing and stays silent for a participant view-only event', async () => {
    // The server does not report a meeting to a viewer who does not own the
    // event; a participant learns the link from their invitation (ADR-0019).
    renderPreview(
      makeEvent({ viewOnly: true, meeting: null } as Partial<CalendarEvent>),
    )

    await waitFor(() => expect(screen.getByText('Standup')).toBeInTheDocument())
    expect(meetingLookups()).toHaveLength(0)
    expect(toasts.error).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Copy meeting link')).toBeNull()
  })

  it('renders no meeting row when the event has none', async () => {
    renderPreview(makeEvent({ meeting: null }))

    await waitFor(() => expect(screen.getByText('Standup')).toBeInTheDocument())
    expect(screen.queryByLabelText('Copy meeting link')).toBeNull()
    expect(meetingLookups()).toHaveLength(0)
  })

  it('renders no meeting row when the payload predates the field', async () => {
    // Undefined, not null: an event constructed locally (import, duplicate)
    // knows nothing about meetings and must not crash the popover.
    renderPreview(makeEvent())

    await waitFor(() => expect(screen.getByText('Standup')).toBeInTheDocument())
    expect(screen.queryByLabelText('Copy meeting link')).toBeNull()
  })
})
