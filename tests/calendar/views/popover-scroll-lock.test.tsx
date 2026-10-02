/**
 * The scroll lock behind the month and year popovers.
 *
 * `<RemoveScroll>` alone was the whole of it, and it is not a scroll lock: it
 * cancels `wheel` and `touch*` at the document level, so the grid it sits
 * inside stayed scrollable by keyboard (Space / PageDown / Home / End), by
 * dragging its scrollbar, and by focus pulling an off-screen control into
 * view. The year popover could be opened and then scrolled out from under
 * itself.
 *
 * These pin the missing half at the view level — the hook has its own unit
 * tests, but only a view knows whether the popover actually opens the lock.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useRef } from 'react'
import MonthView from '@/components/app/views/month-view'
import YearView from '@/components/app/views/year-view'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  Language,
  FirstDayOfWeek,
  ViewConfig,
  TimeFormat,
} from '@/lib/calendar-types'

const config = ViewConfig.create({
  date: new Date(2025, 0, 15),
  timezone: 'UTC',
  timeFormat: TimeFormat.h24(),
  firstDayOfWeek: FirstDayOfWeek.sunday(),
  language: new Language('en'),
})

function timedEvent(n: number): CalendarEvent {
  return {
    id: `e${n}`,
    title: `Event ${n}`,
    startDate: new Date(2025, 0, 15, 10 + n, 0),
    endDate: new Date(2025, 0, 15, 11 + n, 0),
    isAllDay: false,
    recurrence: 'none',
    participants: [],
    notification: 0,
    description: '',
    color: 'bg-[#E6F6FD]',
    calendarId: 'cal-1',
    location: '',
  } as CalendarEvent
}

/** Five events on one day: three render in the cell, two go to the list. */
const EVENTS = [1, 2, 3, 4, 5].map(timedEvent)

/**
 * Stands in for the `overflow-auto` grid wrapper in `calendar.tsx`, which is the
 * element both views are handed as `scrollContainerRef`.
 */
function Harness({
  children,
}: {
  children: (ref: React.RefObject<HTMLDivElement | null>) => React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div data-testid="grid" ref={ref} style={{ overflow: 'auto', height: 400 }}>
      {children(ref)}
    </div>
  )
}

function MonthHarness() {
  return (
    <Harness>
      {(ref) => (
        <MonthView
          date={new Date(2025, 0, 15)}
          events={EVENTS}
          onEventClick={vi.fn()}
          onDayNumberClick={vi.fn()}
          onCellClick={vi.fn()}
          config={config}
          scrollContainerRef={ref}
        />
      )}
    </Harness>
  )
}

function YearHarness() {
  return (
    <Harness>
      {(ref) => (
        <YearView
          date={new Date(2025, 0, 15)}
          events={[]}
          onEventClick={vi.fn()}
          onDayHeaderClick={vi.fn()}
          config={config}
          scrollContainerRef={ref}
        />
      )}
    </Harness>
  )
}

const grid = () => screen.getByTestId('grid') as HTMLDivElement

/** The first day button whose label is `15` — the 15th, an ordinary day. */
function dayButton(label: string): HTMLElement {
  const match = Array.from(grid().querySelectorAll<HTMLElement>('button')).find(
    (b) => b.textContent?.trim() === label,
  )
  if (!match) throw new Error(`no day button labelled ${label}`)
  return match
}

describe('the popover locks the grid it floats over', () => {
  it('month view: "N more events" freezes the grid and releases it on close', async () => {
    render(<MonthHarness />)
    expect(grid().style.overflow).toBe('auto')

    fireEvent.click(screen.getByText('2 more events'))
    await act(async () => {})
    expect(grid().style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Escape' })
    await act(async () => {})
    expect(grid().style.overflow).toBe('auto')
  })

  it('year view: a day opens a popover that freezes the grid', async () => {
    render(<YearHarness />)
    expect(grid().style.overflow).toBe('auto')

    fireEvent.click(dayButton('15'))
    await act(async () => {})

    // Desktop path — this jsdom has no matchMedia, so isMobileViewport()
    // answers false and the day opens the popover rather than a sheet. The
    // popover being open is what makes the lock the expected state.
    expect(
      document.querySelector('[data-slot="popover-content"]'),
    ).not.toBeNull()
    expect(grid().style.overflow).toBe('hidden')
  })

  it('year view: no popover means no lock', () => {
    render(<YearHarness />)
    expect(grid().style.overflow).toBe('auto')
  })
})
