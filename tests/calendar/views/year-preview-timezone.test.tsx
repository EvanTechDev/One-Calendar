import { mock as moduleMock } from 'bun:test'
await import('./../../support/dom')
const { cleanup, fireEvent, render, screen } = await import('../host-render')
import { afterEach, expect, it, vi } from 'bun:test'

import type { CalendarEvent } from '@zntr/ui/calendar/lib/calendar-types'

moduleMock.module(
  '@zntr/ui/calendar/components/providers/calendar-context',
  () => ({
    useCalendar: () => ({ calendars: [], events: [] }),
  }),
)
moduleMock.module(
  '@zntr/ui/calendar/components/providers/data-provider',
  () => ({
    useBookmarks: () => ({
      bookmarks: [],
      createBookmark: vi.fn(),
      deleteBookmark: vi.fn(),
    }),
  }),
)
moduleMock.module('@zntr/ui/calendar/hooks/use-anchored-popover', () => ({
  useLiveAnchorRect: () => null,
  pickPopoverSide: () => 'bottom',
  buildAnchorStyle: () => ({}),
}))
const { default: YearView } =
  await import('@zntr/ui/calendar/components/app/views/year-view')

const { default: EventPreview } =
  await import('@zntr/ui/calendar/components/app/event/event-preview')

const { FirstDayOfWeek, Language, TimeFormat, ViewConfig } =
  await import('@zntr/ui/calendar/lib/calendar-types')

afterEach(cleanup)
const date = new Date(2026, 9, 6)
const event: CalendarEvent = {
  id: 'event',
  title: 'Timezone event',
  startDate: new Date('2026-10-06T08:00:00Z'),
  endDate: new Date('2026-10-06T09:00:00Z'),
  isAllDay: false,
  participants: [],
  notification: null,
  description: '',
  location: '',
  calendarId: '',
  color: '',
}
const config = (timezone: string) =>
  ViewConfig.create({
    date,
    timezone,
    timeFormat: TimeFormat.h24(),
    firstDayOfWeek: FirstDayOfWeek.monday(),
    language: new Language('en'),
  })

it('moves year-view activity and refreshes an already open day list when the zone changes', () => {
  const props = {
    date,
    events: [event],
    onEventClick: vi.fn(),
    onDayHeaderClick: vi.fn(),
  }
  const view = render(<YearView {...props} config={config('Asia/Shanghai')} />)
  const day = (stamp: string) =>
    view.container.querySelector(`[data-event-reveal-date="${stamp}"]`)!
  expect(day('2026-10-06')).toHaveClass('font-semibold')
  fireEvent.click(day('2026-10-06'))
  expect(screen.getByText(event.title)).toBeInTheDocument()
  view.rerender(<YearView {...props} config={config('Etc/GMT+11')} />)
  expect(day('2026-10-06')).not.toHaveClass('font-semibold')
  expect(day('2026-10-05')).toHaveClass('font-semibold')
  expect(screen.queryByText(event.title)).not.toBeInTheDocument()
})

it('updates preview dates and clocks in the selected zone', () => {
  const props = {
    event,
    open: true,
    onOpenChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    _onDuplicate: vi.fn(),
    language: 'en' as const,
  }
  const view = render(<EventPreview {...props} _timezone="Asia/Shanghai" />)
  expect(
    screen.getByText('2026-10-06 16:00 – 2026-10-06 17:00'),
  ).toBeInTheDocument()
  view.rerender(<EventPreview {...props} _timezone="America/New_York" />)
  expect(
    screen.getByText('2026-10-06 04:00 – 2026-10-06 05:00'),
  ).toBeInTheDocument()
  view.rerender(<EventPreview {...props} _timezone="Etc/GMT+11" />)
  expect(
    screen.getByText('2026-10-05 21:00 – 2026-10-05 22:00'),
  ).toBeInTheDocument()
})
