import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WeekView from '@/components/app/views/week-view'
import DayView from '@/components/app/views/day-view'
import type { CalendarEvent } from '@/lib/calendar-types'
import {
  FirstDayOfWeek,
  Language,
  TimeFormat,
  ViewConfig,
} from '@/lib/calendar-types'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as never
Element.prototype.scrollTo ??= function scrollTo() {}

// A real instant: Tuesday 16:00 in Shanghai, Tuesday 04:00 in New York,
// Monday 21:00 at UTC-11. The selected calendar date is a civil date.
const now = new Date('2026-10-06T08:00:00Z')
const date = new Date(2026, 9, 6)
const event: CalendarEvent = {
  id: 'timezone-event',
  title: 'Timezone fixture',
  startDate: now,
  endDate: new Date('2026-10-06T09:00:00Z'),
  isAllDay: false,
  participants: [],
  notification: 0,
  description: '',
  color: 'bg-[#E6F6FD]',
  calendarId: 'test',
  location: '',
}
const events = [event]
const config = (timezone: string) =>
  ViewConfig.create({
    date,
    timezone,
    timeFormat: TimeFormat.h24(),
    firstDayOfWeek: FirstDayOfWeek.monday(),
    language: new Language('en'),
  })
const handlers = { onEventClick: vi.fn(), onTimeSlotClick: vi.fn() }

function renderGrid(kind: 'day' | 'week', extra = {}) {
  const props = {
    date,
    events,
    config: config('America/New_York'),
    ...handlers,
    ...extra,
  }
  return render(
    kind === 'week' ? (
      <WeekView {...props} onDayHeaderClick={vi.fn()} />
    ) : (
      <DayView {...props} />
    ),
  )
}

function gridColumn(container: HTMLElement, kind: 'day' | 'week') {
  return kind === 'week'
    ? container.querySelectorAll('.grid-col')[1]!
    : container.querySelector('.relative.border-l.select-none')!
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('time grid when calendar timezone differs from the system', () => {
  it.each([
    ['America/New_York', '04:00', 240, 1],
    ['Etc/GMT+11', '21:00', 1260, 0],
  ])(
    'switches the week event label, position and date together: %s',
    (zone, label, top, column) => {
      const props = { date, events, ...handlers, onDayHeaderClick: vi.fn() }
      const view = render(
        <WeekView {...props} config={config('Asia/Shanghai')} />,
      )
      expect(
        view.container.querySelector<HTMLElement>('[data-event-id]')?.style.top,
      ).toBe('960px')
      view.rerender(<WeekView {...props} config={config(zone)} />)
      const block =
        view.container.querySelector<HTMLElement>('[data-event-id]')!
      expect(block).toHaveTextContent(label)
      expect(block.style.top).toBe(`${top}px`)
      expect(
        [...view.container.querySelectorAll('.grid-col')].indexOf(
          block.closest('.grid-col')!,
        ),
      ).toBe(column)
    },
  )

  it('moves the week current-time marker to the previous date at UTC-11', () => {
    const props = { date, events: [], ...handlers, onDayHeaderClick: vi.fn() }
    const view = render(
      <WeekView {...props} config={config('Asia/Shanghai')} />,
    )
    view.rerender(<WeekView {...props} config={config('Etc/GMT+11')} />)
    const line = view.container.querySelector<HTMLElement>('.border-cal-now')!
    expect(line.style.top).toBe('1260px')
    expect(
      [...view.container.querySelectorAll('.grid-col')].indexOf(
        line.closest('.grid-col')!,
      ),
    ).toBe(0)
  })

  it('keeps day-view events aligned with the New York current-time marker', () => {
    const view = render(
      <DayView
        date={date}
        events={events}
        {...handlers}
        config={config('America/New_York')}
      />,
    )
    const block = view.container.querySelector<HTMLElement>('[data-event-id]')!
    expect(block).toHaveTextContent('04:00')
    expect(block.style.top).toBe('240px')
    expect(
      view.container.querySelector<HTMLElement>('.border-cal-now')?.style.top,
    ).toBe('240px')
  })

  it('shows the day current-time marker only on the timezone-correct date', () => {
    const props = { events: [], ...handlers, config: config('Etc/GMT+11') }
    const view = render(<DayView {...props} date={date} />)
    expect(view.container.querySelector('.border-cal-now')).toBeNull()
    view.rerender(<DayView {...props} date={new Date(2026, 9, 5)} />)
    expect(
      view.container.querySelector<HTMLElement>('.border-cal-now')?.style.top,
    ).toBe('1260px')
  })

  describe.each(['day', 'week'] as const)('%s grid interactions', (kind) => {
    it('ignores invalid event dates without breaking the timezone-aware grid', () => {
      const view = renderGrid(kind, {
        events: [
          event,
          { ...event, id: 'invalid', startDate: new Date('invalid') },
        ],
      })
      expect(view.container.querySelectorAll('[data-event-id]')).toHaveLength(1)
      expect(view.container.querySelector('[data-event-id]')).toHaveTextContent(
        '04:00',
      )
    })

    it.each([
      ['2026-03-07T14:00:00Z', '2026-03-07T15:00:00Z', new Date(2026, 2, 7)],
      ['2026-03-08T13:00:00Z', '2026-03-08T14:00:00Z', new Date(2026, 2, 8)],
    ])('keeps 09:00 at the same row across DST: %s', (start, end, day) => {
      const view = renderGrid(kind, {
        date: day,
        events: [
          { ...event, startDate: new Date(start), endDate: new Date(end) },
        ],
      })
      const block =
        view.container.querySelector<HTMLElement>('[data-event-id]')!
      expect(block.style.top).toBe('540px')
      expect(block).toHaveTextContent('09:00 - 10:00')
    })

    it('renders a real interval whose wall-clock end precedes its start during the autumn fold', () => {
      const view = renderGrid(kind, {
        date: new Date(2026, 10, 1),
        events: [
          {
            ...event,
            startDate: new Date('2026-11-01T05:30:00Z'),
            endDate: new Date('2026-11-01T06:15:00Z'),
          },
        ],
      })
      const block =
        view.container.querySelector<HTMLElement>('[data-event-id]')!
      expect(block.style.top).toBe('90px')
      expect(block).toHaveTextContent(event.title)
    })

    it('creates an instant in the calendar timezone from a clicked hour', () => {
      const onTimeSlotClick = vi.fn()
      const view = renderGrid(kind, { onTimeSlotClick })
      fireEvent.mouseDown(gridColumn(view.container, kind), {
        button: 0,
        clientY: 240,
      })
      fireEvent.mouseUp(document)
      expect(onTimeSlotClick).toHaveBeenCalledWith(
        new Date('2026-10-06T08:00:00Z'),
        new Date('2026-10-06T08:30:00Z'),
      )
    })

    it('resizes in wall time while returning original events and real instants', () => {
      const onEventDrop = vi.fn()
      const view = renderGrid(kind, { onEventDrop })
      const block = view.container.querySelector('[data-event-id]')!
      fireEvent.mouseDown(block.querySelector('.cursor-ns-resize.bottom-0')!, {
        button: 0,
        clientY: 300,
      })
      fireEvent.mouseMove(document, { clientY: 360 })
      fireEvent.mouseUp(document)
      expect(onEventDrop).toHaveBeenCalledWith(
        event,
        now,
        new Date('2026-10-06T10:00:00Z'),
      )
    })

    it('drags without reapplying the system timezone or mutating the event', () => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
      const onEventDrop = vi.fn()
      const view = renderGrid(kind, { onEventDrop })
      view.container.querySelectorAll('.grid-col').forEach((column, index) => {
        vi.spyOn(column, 'getBoundingClientRect').mockReturnValue({
          left: 100 + index * 100,
          width: 100,
        } as DOMRect)
      })
      fireEvent.mouseDown(view.container.querySelector('[data-event-id]')!, {
        button: 0,
        clientX: 250,
        clientY: 250,
      })
      act(() => vi.advanceTimersByTime(350))
      fireEvent.mouseMove(document, { clientX: 250, clientY: 370 })
      fireEvent.mouseUp(document)
      expect(onEventDrop).toHaveBeenCalledWith(
        event,
        new Date('2026-10-06T10:00:00Z'),
        new Date('2026-10-06T11:00:00Z'),
      )
      expect(event.startDate).toEqual(now)
    })

    it('keeps the editor selection at the clicked calendar time', () => {
      const view = renderGrid(kind, {
        selection: { start: now, end: event.endDate },
      })
      const selection = view.container.querySelector<HTMLElement>(
        '[data-create-selection]',
      )!
      expect(selection.style.top).toBe('240px')
      expect(selection).toHaveTextContent('04:00')
    })
  })

  it('keeps date-only all-day events on their original date at UTC-11', () => {
    const allDay = {
      ...event,
      isAllDay: true,
      startDate: new Date(2026, 9, 6),
      endDate: new Date(2026, 9, 7),
    }
    const props = {
      ...handlers,
      events: [allDay],
      config: config('Etc/GMT+11'),
    }
    const view = render(<DayView {...props} date={date} />)
    expect(view.getByText(event.title)).toBeInTheDocument()
    view.rerender(<DayView {...props} date={new Date(2026, 9, 5)} />)
    expect(view.queryByText(event.title)).toBeNull()
  })

  it('splits an overnight event by calendar days rather than system days', () => {
    const overnight = {
      ...event,
      startDate: new Date('2026-10-06T03:00:00Z'),
      endDate: new Date('2026-10-06T05:00:00Z'),
    }
    const view = renderGrid('week', { events: [overnight] })
    const blocks =
      view.container.querySelectorAll<HTMLElement>('[data-event-id]')
    expect(blocks).toHaveLength(2)
    expect([...blocks].map((block) => block.style.top)).toEqual([
      '1380px',
      '0px',
    ])
    expect(blocks[0]).toHaveTextContent('23:00')
    expect(blocks[1]).toHaveTextContent('00:00 - 01:00')
  })
})
