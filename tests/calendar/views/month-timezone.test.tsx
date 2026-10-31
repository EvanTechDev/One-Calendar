await import('./../../support/dom')
const { cleanup, render } = await import('@testing-library/react')
import { afterEach, expect, it, vi } from 'bun:test'
const { default: MonthView } =
  await import('@zntr/calendar/components/views/month-view')
const { FirstDayOfWeek, Language, TimeFormat, ViewConfig } =
  await import('@zntr/calendar/lib/calendar-types')
import type { CalendarEvent } from '@zntr/calendar/lib/calendar-types'

afterEach(cleanup)
it('moves a timed event to the previous date when switching to UTC-11', () => {
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
  const props = {
    date,
    events: [event],
    onEventClick: vi.fn(),
    onCellClick: vi.fn(),
    onDayNumberClick: vi.fn(),
  }
  const selection = { start: event.startDate, end: event.endDate }
  const view = render(
    <MonthView
      {...props}
      selection={selection}
      config={config('Asia/Shanghai')}
    />,
  )
  const cells = () => [...view.container.querySelectorAll('[data-day-cell]')]
  const containingCell = () =>
    view.getByText(event.title).closest('[data-day-cell]')
  const initialIndex = cells().indexOf(containingCell()!)
  expect(containingCell()).toHaveAttribute('data-create-selection')
  view.rerender(
    <MonthView
      {...props}
      selection={selection}
      config={config('Etc/GMT+11')}
    />,
  )
  expect(cells().indexOf(containingCell()!)).toBe(initialIndex - 1)
  expect(containingCell()).toHaveAttribute('data-create-selection')
})
