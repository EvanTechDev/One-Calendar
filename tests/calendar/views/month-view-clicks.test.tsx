import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MonthView from '@/components/app/views/month-view'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  FirstDayOfWeek,
  Language,
  TimeFormat,
  ViewConfig,
} from '@/lib/calendar-types'

/**
 * The month grid's two clicks.
 *
 * Both fire on the same cell, so the only thing keeping them apart is the day
 * number stopping propagation. This file exists because they are easy to break
 * silently: nothing else in the suite clicks a day cell, and a swallowed click
 * looks exactly like a cell with no events on it.
 */

const config = ViewConfig.create({
  date: new Date(2026, 9, 1),
  timezone: 'UTC',
  timeFormat: TimeFormat.h24(),
  firstDayOfWeek: FirstDayOfWeek.sunday(),
  language: new Language('en'),
})

function renderMonth(over: Record<string, unknown> = {}) {
  const onDayNumberClick = vi.fn()
  const onCellClick = vi.fn()
  const utils = render(
    <MonthView
      config={config}
      date={new Date(2026, 9, 1)}
      events={[] as CalendarEvent[]}
      onEventClick={vi.fn()}
      onDayNumberClick={onDayNumberClick}
      onCellClick={onCellClick}
      {...over}
    />,
  )
  return { ...utils, onCellClick, onDayNumberClick }
}

describe('month view clicks', () => {
  it('jumps to the day view when the day number is clicked', () => {
    const { onDayNumberClick, onCellClick } = renderMonth()

    // The day number is the only role=button inside a cell; the cells
    // themselves are plain divs.
    fireEvent.click(screen.getAllByRole('button')[0])

    expect(onDayNumberClick).toHaveBeenCalledTimes(1)
    expect(onDayNumberClick.mock.calls[0]![0]).toBeInstanceOf(Date)
    // The whole point: it must not also open the create editor.
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('activates the day number from the keyboard', () => {
    const { onDayNumberClick } = renderMonth()
    const dayNumber = screen.getAllByRole('button')[0]!

    fireEvent.keyDown(dayNumber, { key: 'Enter' })

    expect(onDayNumberClick).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys on the day number', () => {
    const { onDayNumberClick } = renderMonth()

    fireEvent.keyDown(screen.getAllByRole('button')[0]!, { key: 'a' })

    expect(onDayNumberClick).not.toHaveBeenCalled()
  })

  it('creates from empty cell space, passing the cell to anchor to', () => {
    const { onCellClick, onDayNumberClick, container } = renderMonth()

    const cell = container.querySelector('[data-day-cell]') as HTMLElement
    // Click low in the cell, clear of the day-number block and of any event.
    fireEvent.click(cell, { clientX: 30, clientY: 90 })

    expect(onCellClick).toHaveBeenCalledTimes(1)
    expect(onCellClick.mock.calls[0]![1]).toBe(cell)
    expect(onCellClick.mock.calls[0]![0]).toBeInstanceOf(Date)
    expect(onDayNumberClick).not.toHaveBeenCalled()
  })
})
