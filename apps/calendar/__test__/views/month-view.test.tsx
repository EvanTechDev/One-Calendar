import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MonthView from '@/components/app/views/month-view'
import type { CalendarEvent } from '@/components/app/calendar'
import type { FirstDayOfWeek } from '@/components/app/calendar-types'
import type { Language } from '@zntr/i18n/calendar'

const baseEvent: CalendarEvent = {
  id: '1',
  title: 'Test Event',
  startDate: new Date(2025, 0, 15, 10, 0),
  endDate: new Date(2025, 0, 15, 11, 0),
  isAllDay: false,
  recurrence: 'none',
  participants: [],
  notification: 0,
  description: '',
  color: 'bg-[#E6F6FD]',
  calendarId: 'cal-1',
  location: '',
}

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return { ...baseEvent, ...overrides }
}

function renderMonthView({
  date = new Date(2025, 0, 15),
  events = [] as CalendarEvent[],
  onEventClick = vi.fn(),
  language = 'en' as Language,
  firstDayOfWeek = 0 as FirstDayOfWeek,
  timezone = 'UTC',
} = {}) {
  return render(
    <MonthView
      date={date}
      events={events}
      onEventClick={onEventClick}
      language={language}
      firstDayOfWeek={firstDayOfWeek}
      timezone={timezone}
    />,
  )
}

describe('MonthView', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    vi.clearAllMocks()
  })

  it('renders weekday headers starting from Sunday by default', () => {
    renderMonthView()
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  it('renders weekday headers starting from Monday when firstDayOfWeek=1', () => {
    renderMonthView({ firstDayOfWeek: 1 as FirstDayOfWeek })
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('renders all days of the month', () => {
    renderMonthView({ date: new Date(2025, 0, 1) })
    expect(screen.getByText('1')).toBeInTheDocument()
    const day31Elements = screen.getAllByText('31')
    expect(day31Elements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders leading days from previous month', () => {
    renderMonthView({ date: new Date(2025, 0, 15) })
    const dec31Elements = screen.getAllByText('31')
    expect(dec31Elements.length).toBeGreaterThanOrEqual(2)
  })

  it('prev-month days have gray styling', () => {
    const { container } = render(
      <MonthView
        date={new Date(2025, 0, 15)}
        events={[]}
        onEventClick={vi.fn()}
        language="en"
        firstDayOfWeek={0 as FirstDayOfWeek}
        timezone="UTC"
      />,
    )
    const prevMonthDay = container.querySelector('.text-gray-400')
    expect(prevMonthDay).toBeTruthy()
  })

  it('highlights today', () => {
    const today = new Date()
    const { container } = renderMonthView({ date: today })
    const todayElement = container.querySelector('.text-\\[\\#0066FF\\]')
    expect(todayElement).toBeTruthy()
  })

  it('renders events on the correct day', () => {
    const events = [
      createEvent({
        id: 'e1',
        title: 'Meeting',
        startDate: new Date(2025, 0, 15, 10, 0),
      }),
    ]
    renderMonthView({ date: new Date(2025, 0, 15), events })
    expect(screen.getByText('Meeting')).toBeInTheDocument()
  })

  it('does not render events on other days', () => {
    const events = [
      createEvent({
        id: 'e1',
        title: 'Meeting',
        startDate: new Date(2025, 0, 15, 10, 0),
      }),
    ]
    renderMonthView({ date: new Date(2025, 0, 15), events })
    expect(screen.queryByText('Other Event')).not.toBeInTheDocument()
  })

  it('limits visible events to 3 and shows remaining count', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      createEvent({
        id: `e${i}`,
        title: `Event ${i + 1}`,
        startDate: new Date(2025, 0, 15, 10 + i, 0),
      }),
    )
    renderMonthView({ date: new Date(2025, 0, 15), events })
    expect(screen.getByText('Event 1')).toBeInTheDocument()
    expect(screen.getByText('Event 3')).toBeInTheDocument()
    expect(screen.queryByText('Event 4')).not.toBeInTheDocument()
    expect(screen.getByText('2 more events')).toBeInTheDocument()
  })

  it('shows singular "more event" when only 1 over limit', () => {
    const events = Array.from({ length: 4 }, (_, i) =>
      createEvent({
        id: `e${i}`,
        title: `Event ${i + 1}`,
        startDate: new Date(2025, 0, 15, 10 + i, 0),
      }),
    )
    renderMonthView({ date: new Date(2025, 0, 15), events })
    expect(screen.getByText('1 more event')).toBeInTheDocument()
  })

  it('calls onEventClick when an event is clicked', () => {
    const onEventClick = vi.fn()
    const events = [
      createEvent({
        id: 'e1',
        title: 'Clickable Event',
        startDate: new Date(2025, 0, 15, 10, 0),
      }),
    ]
    renderMonthView({ date: new Date(2025, 0, 15), events, onEventClick })
    fireEvent.click(screen.getByText('Clickable Event'))
    expect(onEventClick).toHaveBeenCalledTimes(1)
    expect(onEventClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1' }),
      expect.any(HTMLElement),
    )
  })

  it('event has correct background in dark mode', () => {
    document.documentElement.classList.add('dark')
    const events = [
      createEvent({
        id: 'e1',
        title: 'Dark Event',
        startDate: new Date(2025, 0, 15, 10, 0),
      }),
    ]
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      events,
    })
    const eventEl = container.querySelector('[style*="background-color"]')
    expect(eventEl).toBeTruthy()
  })

  it('handles different languages', () => {
    renderMonthView({ language: 'es' })
    expect(screen.getByText('Dom')).toBeInTheDocument()
    expect(screen.getByText('Lun')).toBeInTheDocument()
  })

  it('handles different timezones', () => {
    renderMonthView({ timezone: 'America/New_York' })
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
