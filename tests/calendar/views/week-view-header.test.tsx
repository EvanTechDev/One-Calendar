import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WeekView from '@/components/app/views/week-view'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  FirstDayOfWeek,
  Language,
  TimeFormat,
  ViewConfig,
} from '@/lib/calendar-types'

/**
 * The week grid's day headers navigate to the day view.
 *
 * WeekView had no render test at all before this, so the header was untested
 * the same way the month grid was: the handler existed, or did not, and nothing
 * clicked it.
 */

// WeekView measures its scrollbar with a ResizeObserver, which jsdom has never
// implemented. The stub records nothing; the header has no layout dependency,
// so the width it would compute is not what this file is about.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as never

// The view scrolls itself to the configured hour on mount. jsdom's elements
// have no layout, so scrollTo does not exist.
Element.prototype.scrollTo ??= function scrollTo() {}
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const config = ViewConfig.create({
  date: new Date(2026, 9, 1),
  timezone: 'UTC',
  timeFormat: TimeFormat.h24(),
  firstDayOfWeek: FirstDayOfWeek.sunday(),
  language: new Language('en'),
})

function renderWeek(
  props: Partial<React.ComponentProps<typeof WeekView>> = {},
) {
  const onDayHeaderClick = vi.fn()
  const utils = render(
    <WeekView
      config={config}
      date={new Date(2026, 9, 1)}
      events={[] as CalendarEvent[]}
      onDayHeaderClick={onDayHeaderClick}
      onEventClick={vi.fn()}
      onTimeSlotClick={vi.fn()}
      {...props}
    />,
  )
  return { ...utils, onDayHeaderClick }
}

/** The seven header controls, in the order the week lays them out. */
function headers(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
}

describe('week view day headers', () => {
  it('renders one header control per day shown', () => {
    const { container, unmount } = renderWeek()

    expect(headers(container)).toHaveLength(7)
    unmount()

    const four = renderWeek({ daysToShow: 4 })
    expect(headers(four.container)).toHaveLength(4)
  })

  it('opens that day when its weekday name and date are clicked', () => {
    const { container, onDayHeaderClick } = renderWeek()

    // 1 October 2026 is a Thursday, so it is the fifth column of a week
    // starting on Sunday.
    fireEvent.click(headers(container)[4]!)

    expect(onDayHeaderClick).toHaveBeenCalledTimes(1)
    const day = onDayHeaderClick.mock.calls[0]![0] as Date
    expect(day.getDate()).toBe(1)
    expect(day.getMonth()).toBe(9)
  })

  it('names each header with its full date, not the bare day number', () => {
    const { container } = renderWeek()

    for (const header of headers(container)) {
      // "15" would be a useless accessible name for seven controls.
      expect(header.textContent).not.toBe(header.getAttribute('aria-label'))
      expect(header.getAttribute('aria-label')).toBeTruthy()
    }
  })

  it('is keyboard reachable', () => {
    const { container, onDayHeaderClick } = renderWeek()

    fireEvent.keyDown(headers(container)[0]!, { key: 'Enter' })

    expect(onDayHeaderClick).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', () => {
    const { container, onDayHeaderClick } = renderWeek()

    fireEvent.keyDown(headers(container)[0]!, { key: 'a' })

    expect(onDayHeaderClick).not.toHaveBeenCalled()
  })
})
