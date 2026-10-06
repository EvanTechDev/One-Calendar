import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '../host-render'
import { BookmarkPanelBody } from '@zntr/ui/calendar/components/app/sidebar/bookmark-panel'
import { eventDataToCalendarEvent } from '@zntr/ui/calendar/components/providers/calendar-context'
import { useEventPreviewNavigation } from '@zntr/ui/calendar/hooks/use-event-preview-navigation'
import { toCalendarDate } from '@zntr/ui/calendar/lib/zoned-date'
import type { BookmarkData, EventData } from '@zntr/ui/calendar/lib/api-client'
import type { CalendarEvent } from '@zntr/ui/calendar/lib/calendar-types'

const state = vi.hoisted(() => ({
  bookmarks: [] as BookmarkData[],
  events: [] as CalendarEvent[],
  deleteBookmark: vi.fn(),
}))
vi.mock('@zntr/ui/calendar/components/providers/data-provider', () => ({
  useBookmarks: () => ({
    bookmarks: state.bookmarks,
    deleteBookmark: state.deleteBookmark,
  }),
}))
vi.mock(
  '@zntr/ui/calendar/components/providers/calendar-context',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@zntr/ui/calendar/components/providers/calendar-context')
    >()),
    useCalendar: () => ({ events: state.events }),
  }),
)
vi.mock('@zntr/i18n/calendar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@zntr/i18n/calendar')>()),
  useLanguage: () => ['en', vi.fn()],
}))

const event: EventData = {
  id: 'event-outside-loaded-range',
  userId: 'owner',
  title: 'Bookmarked trip',
  startDate: '2026-10-06T02:00:00Z',
  endDate: '2026-10-06T03:00:00Z',
  isAllDay: false,
  description: 'Trip details',
  location: 'Station',
  color: 'bg-blue-500',
  categoryId: 'travel',
  participants: [{ name: 'Guest', email: 'guest@example.com' }],
  notificationMinutes: 0,
  emailReminder: true,
  viewOnly: true,
  organizer: { name: 'Owner', email: 'owner@example.com', image: null },
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}

beforeEach(() => {
  state.bookmarks = [
    { id: 'bookmark-1', eventId: event.id, createdAt: event.createdAt, event },
  ]
  state.events = []
  state.deleteBookmark.mockReset()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})

it('opens an unloaded bookmark with real dates and reveals its day in the calendar timezone', async () => {
  const onEventClick = vi.fn<(event: CalendarEvent) => void>()
  const onRequestClose = vi.fn()
  const onReady = vi.fn()
  const view = render(
    <BookmarkPanelBody
      onEventClick={onEventClick}
      onRequestClose={onRequestClose}
    />,
  )
  fireEvent.click(screen.getByText(event.title))
  expect(onRequestClose).toHaveBeenCalledOnce()
  const selected = onEventClick.mock.calls[0][0]
  // This is the conversion performed by navigation when the event's grid
  // anchor is not mounted. An ISO string reaches Intl as NaN and throws.
  expect(() => toCalendarDate(selected.startDate, 'Etc/GMT+11')).not.toThrow()
  expect(selected).toMatchObject(eventDataToCalendarEvent(event))

  const reveal = document.createElement('button')
  reveal.dataset.eventRevealDate = '2026-10-05'
  const anchor = document.createElement('button')
  anchor.dataset.eventId = event.id
  reveal.onclick = () => view.container.append(anchor)
  view.container.append(reveal)
  const containerRef = { current: view.container }
  renderHook(() =>
    useEventPreviewNavigation(selected, containerRef, onReady, 'Etc/GMT+11'),
  )
  await waitFor(() => expect(onReady).toHaveBeenCalledWith(anchor))
})

it('preserves all-day and recurrence metadata and prefers the live event', () => {
  const live: CalendarEvent = {
    ...eventDataToCalendarEvent(event),
    title: 'Updated trip',
    isAllDay: true,
    seriesId: 'series',
    recurrenceId: '20261006T000000',
    startDate: new Date(2026, 9, 6),
    endDate: new Date(2026, 9, 7),
  }
  state.events = [live]
  const onEventClick = vi.fn()
  render(
    <BookmarkPanelBody onEventClick={onEventClick} onRequestClose={vi.fn()} />,
  )
  fireEvent.click(screen.getByText(live.title))
  expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining(live))
})

it('removes the bookmark by its own id without opening the event', () => {
  const onEventClick = vi.fn()
  render(
    <BookmarkPanelBody onEventClick={onEventClick} onRequestClose={vi.fn()} />,
  )
  fireEvent.click(screen.getByRole('button', { name: /remove bookmark/i }))
  expect(state.deleteBookmark).toHaveBeenCalledWith('bookmark-1')
  expect(onEventClick).not.toHaveBeenCalled()
})
