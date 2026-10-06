import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MonthView from '@zntr/calendar-ui/components/app/views/month-view'
import type { CalendarEvent } from '@zntr/calendar-ui/components/app/calendar'
import {
  FirstDayOfWeek,
  Language,
  TimeFormat,
  ViewConfig,
} from '@zntr/calendar-ui/lib/calendar-types'

/**
 * The month grid's two gestures.
 *
 * These exist because the first version of this feature declared the two
 * handlers in MonthViewProps, called them from the cells, and never
 * destructured them — so both threw ReferenceError and did nothing, and
 * oxlint reported the file clean. Nothing else in the suite clicked a cell, so
 * nothing else noticed. These click both.
 */

const config = ViewConfig.create({
  date: new Date(2026, 9, 1),
  timezone: 'UTC',
  timeFormat: TimeFormat.h24(),
  firstDayOfWeek: FirstDayOfWeek.sunday(),
  language: new Language('en'),
})

function renderMonth() {
  const onDayNumberClick = vi.fn()
  const onCellClick = vi.fn()
  const utils = render(
    <MonthView
      config={config}
      date={new Date(2026, 9, 1)}
      events={[] as CalendarEvent[]}
      onCellClick={onCellClick}
      onDayNumberClick={onDayNumberClick}
      onEventClick={vi.fn()}
    />,
  )
  return { ...utils, onCellClick, onDayNumberClick }
}

describe('month view gestures', () => {
  it('opens that day when the day number is clicked', () => {
    const { onDayNumberClick, onCellClick } = renderMonth()

    fireEvent.click(renderMonthDayNumber())

    expect(onDayNumberClick).toHaveBeenCalledTimes(1)
    expect(onDayNumberClick.mock.calls[0]![0]).toBeInstanceOf(Date)
    // The whole point of the two gestures being separate.
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('opens that day from the keyboard too', () => {
    const { onDayNumberClick } = renderMonth()

    fireEvent.keyDown(renderMonthDayNumber(), { key: 'Enter' })

    expect(onDayNumberClick).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys on the day number', () => {
    const { onDayNumberClick } = renderMonth()

    fireEvent.keyDown(renderMonthDayNumber(), { key: 'a' })

    expect(onDayNumberClick).not.toHaveBeenCalled()
  })

  it('creates from empty cell space', () => {
    const { onCellClick, onDayNumberClick, container } = renderMonth()

    const cell = container.querySelector('[data-day-cell]') as HTMLElement
    fireEvent.click(cell)

    expect(onCellClick).toHaveBeenCalledTimes(1)
    expect(onCellClick.mock.calls[0]![0]).toBeInstanceOf(Date)
    expect(onDayNumberClick).not.toHaveBeenCalled()
  })

  it('only treats the number itself as the target, not the strip above it', () => {
    const { onDayNumberClick, onCellClick, container } = renderMonth()

    const cell = container.querySelector('[data-day-cell]') as HTMLElement
    // The strip is a full-cell-width box above the events. Clicking to the
    // LEFT of the number, inside that strip, is empty space — it has to create
    // rather than navigate, or aiming for a gap takes you to the day view.
    fireEvent.click(cell, { clientX: 4, clientY: 6 })

    expect(onDayNumberClick).not.toHaveBeenCalled()
    expect(onCellClick).toHaveBeenCalledTimes(1)
  })

  it('reports the day the cell belongs to, not the month anchor', () => {
    const { onCellClick, container } = renderMonth()

    // 1 October 2026 is a Thursday; the grid starts on Sunday the 27th of
    // September, so the first cell is NOT the date prop.
    const cells = container.querySelectorAll('[data-day-cell]')
    fireEvent.click(cells[0] as HTMLElement)

    const day = onCellClick.mock.calls[0]![0] as Date
    expect(day.getDate()).toBe(27)
    expect(day.getMonth()).toBe(8)
  })
})

/** The first day-number control, which is a cell's only role=button. */
function renderMonthDayNumber(): HTMLElement {
  return document.querySelector<HTMLElement>('[role="button"]')!
}
