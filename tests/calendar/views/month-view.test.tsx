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
  onDayNumberClick = vi.fn(),
  onCellClick = vi.fn(),
  config,
  selection = null,
}: {
  date?: Date
  events?: CalendarEvent[]
  onEventClick?: (event: CalendarEvent, anchorEl?: HTMLElement | null) => void
  onDayNumberClick?: (day: Date) => void
  onCellClick?: (day: Date) => void
  config?: ViewConfig
  selection?: { start: Date; end: Date } | null
} = {}) {
  return render(
    <MonthView
      date={date}
      events={events}
      onEventClick={onEventClick}
      onDayNumberClick={onDayNumberClick}
      onCellClick={onCellClick}
      config={config ?? makeConfig()}
      selection={selection}
    />,
  )
}

/** Cells carrying the draft-selection outline, in DOM (grid) order. */
function selectedCells(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-day-cell]'),
  ).filter((cell) => cell.className.includes('border-cal-accent/40'))
}

/** Tailwind abbreviates the sides: `border-r-0`, not `border-right-0`. */
const SIDECLASS = { top: 't', right: 'r', bottom: 'b', left: 'l' } as const

/**
 * Which of the four edges a cell paints in the selection's ACCENT colour.
 *
 * A side is accent when it was not dropped with `border-<side>-0` and was not
 * handed back to the grey divider with `border-r-border`.
 */
function edges(cell: HTMLElement): string[] {
  return (['top', 'right', 'bottom', 'left'] as const).filter((side) => {
    if (cell.className.includes(`border-${SIDECLASS[side]}-0`)) return false
    if (side === 'right' && cell.className.includes('border-r-border'))
      return false
    return true
  })
}

/** True when the cell draws the grey divider along its right edge. */
function hasDivider(cell: HTMLElement): boolean {
  return cell.className.includes('border-r')
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

  // The "more events" button lives inside the cell, and the cell opens the
  // create-event popover. Without a stopPropagation both popovers opened.
  it('opens only the remaining-events popover, not the create editor', () => {
    const onCellClick = vi.fn()
    const events = Array.from({ length: 5 }, (_, i) =>
      createEvent({
        id: `e${i}`,
        title: `Event ${i + 1}`,
        startDate: new Date(2025, 0, 15, 10 + i, 0),
      }),
    )
    renderMonthView({ date: new Date(2025, 0, 15), events, onCellClick })

    fireEvent.click(screen.getByText('2 more events'))

    expect(onCellClick).not.toHaveBeenCalled()
    expect(screen.getByText('Event 4')).toBeInTheDocument()
    expect(screen.getByText('Event 5')).toBeInTheDocument()
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

  it('opens the preview for a timed event, not the create editor', () => {
    // The cell's own click opens the create-event popover, so a timed bar that
    // let the click through opened the editor ON TOP of the preview it had just
    // requested — the event looked like it could not be opened at all. The
    // all-day bars already stopped propagation; these did not.
    const onCellClick = vi.fn()
    const onEventClick = vi.fn()
    renderMonthView({
      date: new Date(2025, 0, 15),
      events: [
        createEvent({
          id: 'timed',
          title: 'Standup',
          startDate: new Date(2025, 0, 15, 10, 0),
        }),
      ],
      onCellClick,
      onEventClick,
    })

    fireEvent.click(screen.getByText('Standup'))

    expect(onEventClick).toHaveBeenCalledTimes(1)
    expect(onCellClick).not.toHaveBeenCalled()
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

  it('reserves just the gap on a day no all-day bar covers', () => {
    const { container } = renderMonthView({ date: new Date(2025, 0, 15) })
    expect(new Set(bands(container))).toEqual(new Set(['7px']))
  })

  it('reserves a lane plus a gap only for the days the bar covers', () => {
    // The blank-slot bug was a day inheriting the whole ROW's lane count, not
    // the floor: with per-column reservation the covered day reserves its own
    // lane and its neighbours stay at the gap. A lane is 28px (24px bar + 4px
    // gap), and a covered day adds one more 4px on top so the bar does not sit
    // flush against the first timed event. A midnight end is exclusive, so this
    // bar covers Jan 15 alone. Jan 2025 starts on a Wednesday and weeks start
    // Sunday, so Jan 12..18 is the third row.
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
    expect(bands(container).slice(14, 21)).toEqual([
      '7px',
      '7px',
      '7px',
      '32px',
      '7px',
      '7px',
      '7px',
    ])
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
    // too — so 2 x 28px plus the 4px trailing gap that separates the last bar
    // from that day's timed events. Jan 2025 starts on a Wednesday and weeks
    // start Sunday, so Jan 12..18 is the third row.
    expect(bands(container).slice(14, 21)).toEqual([
      '7px',
      '7px',
      '32px',
      '60px',
      '60px',
      '7px',
      '7px',
    ])
  })
})

describe('MonthView draft-selection outline', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    vi.clearAllMocks()
  })

  // Jan 2025 starts on a Wednesday and weeks start Sunday, so Jan 12..18 is
  // the third row and Jan 15/16 are its 4th and 5th columns.
  const thirdRow = 14

  /** A range covering the given days of Jan 2025, whole-day. */
  const range = (from: number, to: number) => ({
    start: new Date(2025, 0, from, 0, 0),
    end: new Date(2025, 0, to, 23, 59),
  })

  it('paints every side of a lone selected day', () => {
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      selection: range(15, 15),
    })
    const cells = selectedCells(container)
    expect(cells).toHaveLength(1)
    expect(edges(cells[0])).toEqual(['top', 'right', 'bottom', 'left'])
  })

  it('paints the edge two adjacent selected days share only once', () => {
    // A `ring` painted all four sides of BOTH cells, so the edge between them
    // was drawn twice and read as a doubled border — the bug this replaced.
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      selection: range(15, 16),
    })
    const cells = selectedCells(container)
    expect(cells).toHaveLength(2)
    // Neither paints the shared edge in accent, so it is not drawn twice.
    expect(edges(cells[0])).toEqual(['top', 'bottom', 'left'])
    expect(edges(cells[1])).toEqual(['top', 'right', 'bottom'])
    // The SECOND cell drops its left edge, because the first one draws the
    // divider they share; the first keeps a free accent left edge, because
    // nothing is selected to its left.
    expect(cells[1].className).toContain('border-l-0')
    expect(cells[0].className).not.toContain('border-l-0')

    // And it is not gone either: the grey divider between two columns is drawn
    // by the LEFT cell's right border, so exactly one of them carries it, in
    // the grid's grey rather than the accent.
    expect(hasDivider(cells[0])).toBe(true)
    expect(hasDivider(cells[1])).toBe(false)
    expect(cells[0].className).toContain('border-r-border')
  })

  it('paints only the outer edges of a run spanning several days', () => {
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      selection: range(15, 17),
    })
    const cells = selectedCells(container)
    expect(cells).toHaveLength(3)
    expect(edges(cells[0])).toEqual(['top', 'bottom', 'left'])
    expect(edges(cells[1])).toEqual(['top', 'bottom'])
    expect(edges(cells[2])).toEqual(['top', 'right', 'bottom'])
  })

  it('paints both row-end edges when the run crosses a week row', () => {
    // Jan 18 is the last column of its row and Jan 19 the first of the next, so
    // they share no edge — each keeps the edge at its end of the grid. Treating
    // them as date-adjacent neighbours would drop both and open a gap.
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      selection: range(18, 19),
    })
    const cells = selectedCells(container)
    const all = container.querySelectorAll('[data-day-cell]')
    expect(cells).toHaveLength(2)
    expect(cells[0]).toBe(all[thirdRow + 6])
    expect(cells[1]).toBe(all[thirdRow + 7])
    expect(edges(cells[0])).toContain('right')
    expect(edges(cells[1])).toContain('left')
  })

  it('shares the horizontal edge between rows rather than doubling it', () => {
    // The row above/below is ±7 days and the two cells are vertically
    // adjacent, so the edge between them is one line, not two.
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      selection: range(15, 22),
    })
    const cells = selectedCells(container)
    expect(cells).toHaveLength(8)
    expect(edges(cells[0])).toContain('top')
    expect(edges(cells[0])).not.toContain('bottom')
    expect(edges(cells[7])).toContain('bottom')
    expect(edges(cells[7])).not.toContain('top')
  })

  it('leaves every cell unoutlined when nothing is selected', () => {
    const { container } = renderMonthView({ date: new Date(2025, 0, 15) })
    expect(selectedCells(container)).toHaveLength(0)
  })

  it('authors no css for the outline, so there is no colour to get wrong', () => {
    // The two previous attempts both wrote a `box-shadow` string by hand and
    // both shipped a cell with NO visible outline: once by naming a token
    // `@theme inline` never emits, once with a bare `color-mix()` that
    // invalidates the declaration. Every property must come from a utility
    // Tailwind compiles, which guards its `color-mix()` behind `@supports`.
    const { container } = renderMonthView({
      date: new Date(2025, 0, 15),
      selection: range(15, 16),
    })
    for (const cell of selectedCells(container)) {
      expect(cell.getAttribute('style')).toBeNull()
    }
  })
})
