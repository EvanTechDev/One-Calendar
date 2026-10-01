import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MonthView from '@/components/app/views/month-view'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  Language,
  FirstDayOfWeek,
  ViewConfig,
  TimeFormat,
} from '@/lib/calendar-types'

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

function makeConfig(
  overrides: {
    language?: Language
    firstDayOfWeek?: FirstDayOfWeek
    timezone?: string
  } = {},
): ViewConfig {
  return ViewConfig.create({
    date: new Date(2025, 0, 15),
    timezone: overrides.timezone ?? 'UTC',
    timeFormat: TimeFormat.h24(),
    firstDayOfWeek: overrides.firstDayOfWeek ?? FirstDayOfWeek.sunday(),
    language: overrides.language ?? new Language('en'),
  })
}

function renderMonthView({
  date = new Date(2025, 0, 15),
  events = [] as CalendarEvent[],
  onEventClick = vi.fn(),
  config,
}: {
  date?: Date
  events?: CalendarEvent[]
  onEventClick?: (event: CalendarEvent, anchorEl?: HTMLElement | null) => void
  config?: ViewConfig
} = {}) {
  return render(
    <MonthView
      date={date}
      events={events}
      onEventClick={onEventClick}
      config={config ?? makeConfig()}
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
    renderMonthView({
      config: makeConfig({ firstDayOfWeek: FirstDayOfWeek.create(1) }),
    })
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('renders all days of the month', () => {
    renderMonthView({ date: new Date(2025, 0, 1) })
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
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
        config={makeConfig()}
      />,
    )
    const prevMonthDay = container.querySelector('.text-gray-400')
    expect(prevMonthDay).toBeTruthy()
  })

  it('highlights today', () => {
    const today = new Date()
    const { container } = renderMonthView({ date: today })
    const todayElement = container.querySelector('.bg-cal-today')
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
      expect.any(Number),
      expect.any(Number),
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

  it('renders a multi-day all-day event as a single spanning bar', () => {
    const events = [
      createEvent({
        id: 'span',
        title: 'Multi Day Trip',
        isAllDay: true,
        startDate: new Date(2025, 0, 14, 0, 0),
        endDate: new Date(2025, 0, 16, 23, 59),
      }),
    ]
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      events,
    })
    const bars = container.querySelectorAll('[data-event-id="span"]')
    expect(bars).toHaveLength(1)
    expect(screen.getByText('Multi Day Trip')).toBeInTheDocument()
  })

  it('splits a multi-day all-day event crossing a week boundary into one bar per week row', () => {
    // Jan 2025, weeks start Sunday: Jan 18 is Saturday, Jan 19 is Sunday.
    const events = [
      createEvent({
        id: 'cross',
        title: 'Cross Week',
        isAllDay: true,
        startDate: new Date(2025, 0, 17, 0, 0),
        endDate: new Date(2025, 0, 20, 23, 59),
      }),
    ]
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      events,
    })
    const bars = container.querySelectorAll('[data-event-id="cross"]')
    expect(bars).toHaveLength(2)
  })

  it('handles different languages', () => {
    renderMonthView({ config: makeConfig({ language: new Language('es') }) })
    expect(screen.getByText('Dom')).toBeInTheDocument()
    expect(screen.getByText('Lun')).toBeInTheDocument()
  })

  it('handles different timezones', () => {
    renderMonthView({ config: makeConfig({ timezone: 'America/New_York' }) })
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
  })
})

describe('MonthView cell geometry', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    vi.clearAllMocks()
  })

  /** Reserved all-day band height per day cell, in DOM order. */
  function bands(container: HTMLElement): string[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>('[data-all-day-band]'),
    ).map((el) => el.style.height)
  }

  it('gives every day number the same 24px line box as the today chip', () => {
    // Today's number is a filled 24px square (h-6); a bare number is only as
    // tall as text-sm's line height, so without leading-6 it floats inside the
    // block and today's number-to-event distance reads shorter than its
    // neighbours'.
    const { container } = renderMonthView({ date: new Date() })
    const numbers = container.querySelectorAll(
      '[data-day-cell] > div:first-child > span',
    )
    expect(numbers.length).toBeGreaterThan(0)
    for (const number of numbers) {
      expect(number.className).toContain('leading-6')
    }
    expect(container.querySelector('.bg-cal-today')?.className).toContain(
      'leading-6',
    )
  })

  it('reserves one lane on every day, so no empty event slot appears', () => {
    const { container } = renderMonthView({ date: new Date(2025, 0, 15) })
    expect(new Set(bands(container))).toEqual(new Set(['28px']))
  })

  it('gives every day the same band when a single-day all-day event is present', () => {
    // The regression this guards: reserving per day left the bar-less days of
    // that week 20px higher than the covered day, so the event blocks stopped
    // lining up. Flooring the reservation at one lane collapses the 0-lane and
    // 1-lane cases to the same height, so the whole grid stays uniform.
    const events = [
      createEvent({
        id: 'ad',
        title: 'One Day Off',
        isAllDay: true,
        startDate: new Date(2025, 0, 15, 0, 0),
        endDate: new Date(2025, 0, 16, 0, 0),
      }),
    ]
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      events,
    })
    expect(container.querySelector('[data-event-id="ad"]')).toBeTruthy()
    expect(new Set(bands(container))).toEqual(new Set(['28px']))
  })

  it('reserves the extra lane only where all-day bars actually stack', () => {
    const events = [
      createEvent({
        id: 'a',
        title: 'Trip Leg One',
        isAllDay: true,
        startDate: new Date(2025, 0, 14, 0, 0),
        endDate: new Date(2025, 0, 16, 0, 0),
      }),
      createEvent({
        id: 'b',
        title: 'Trip Leg Two',
        isAllDay: true,
        startDate: new Date(2025, 0, 15, 0, 0),
        endDate: new Date(2025, 0, 17, 0, 0),
      }),
    ]
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      events,
    })
    // A midnight end is exclusive, so leg one covers Jan 14-15 and leg two
    // Jan 15-16, overlapping on Jan 15 and pushing leg two into lane 1. Both
    // of leg two's columns need room for two lanes — the lane above it counts
    // too. Jan 2025 starts on a Wednesday and weeks start Sunday, so Jan
    // 12..18 is the third row.
    expect(bands(container).slice(14, 21)).toEqual([
      '28px',
      '28px',
      '28px',
      '56px',
      '56px',
      '28px',
      '28px',
    ])
  })
})
