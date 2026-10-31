'use client'

import { useState, type CSSProperties } from 'react'
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { CalendarViewTypeValue } from '@zntr/calendar/lib/calendar-types'

// This is an empty illustration of the supported views, not a signed-in
// calendar or a source of sample events. Dates use UTC to keep SSR consistent.
export const PREVIEW_VIEWS: {
  value: CalendarViewTypeValue
  label: string
  description: string
}[] = [
  {
    value: 'day',
    label: 'Day',
    description: 'One day, with room to see the hours.',
  },
  {
    value: 'four-day',
    label: 'Four days',
    description: 'A closer look at the next few days.',
  },
  {
    value: 'week',
    label: 'Week',
    description: 'See the week’s commitments side by side.',
  },
  {
    value: 'month',
    label: 'Month',
    description: 'The shape of a month, one date at a time.',
  },
  {
    value: 'year',
    label: 'Year',
    description: 'Twelve months. A longer view of your plans.',
  },
]

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC',
})
const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + amount)
  return result
}

function monday(date: Date) {
  return addDays(date, -((date.getUTCDay() + 6) % 7))
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function monthDays(date: Date) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const start = monday(first)
  const count = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate()
  const cells = Math.ceil((((first.getUTCDay() + 6) % 7) + count) / 7) * 7
  return Array.from({ length: cells }, (_, index) => addDays(start, index))
}

function MonthGrid({
  date,
  today,
  compact = false,
}: {
  date: Date
  today: string
  compact?: boolean
}) {
  return (
    <div
      className={compact ? 'landing-mini-month' : 'landing-month-grid'}
      aria-hidden="true"
    >
      {weekdays.map((day) => (
        <span className="landing-weekday" key={day}>
          {compact ? day[0] : day}
        </span>
      ))}
      {monthDays(date).map((day) => (
        <div
          className="landing-date-cell"
          data-outside={day.getUTCMonth() !== date.getUTCMonth() || undefined}
          key={dateKey(day)}
        >
          <span data-today={dateKey(day) === today || undefined}>
            {day.getUTCDate()}
          </span>
        </div>
      ))}
    </div>
  )
}

function TimeGrid({
  date,
  today,
  count,
}: {
  date: Date
  today: string
  count: number
}) {
  const start = count === 7 ? monday(date) : date
  const days = Array.from({ length: count }, (_, index) =>
    addDays(start, index),
  )
  return (
    <div
      className="landing-time-grid"
      style={{ '--preview-days': count } as CSSProperties}
      aria-hidden="true"
    >
      <span className="landing-time-zone">UTC</span>
      {days.map((day) => (
        <div className="landing-time-day" key={dateKey(day)}>
          <span>{weekdays[(day.getUTCDay() + 6) % 7]}</span>
          <span data-today={dateKey(day) === today || undefined}>
            {day.getUTCDate()}
          </span>
        </div>
      ))}
      {Array.from({ length: 6 }, (_, index) => (
        <div className="landing-time-row" key={index}>
          <span className="landing-hour">
            {String(index + 8).padStart(2, '0')}:00
          </span>
          {days.map((day) => (
            <span className="landing-time-slot" key={dateKey(day)} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function LandingCalendarPreview({ today }: { today: string }) {
  const [view, setView] = useState<CalendarViewTypeValue>('month')
  const [date, setDate] = useState(() => new Date(`${today}T00:00:00Z`))
  const selected = PREVIEW_VIEWS.find((item) => item.value === view)!
  const heading =
    view === 'year'
      ? String(date.getUTCFullYear())
      : view === 'day'
        ? dateFormat.format(date)
        : `${monthFormat.format(date)} ${date.getUTCFullYear()}`

  function navigate(direction: number) {
    setDate((current) => {
      if (view === 'year')
        return new Date(
          Date.UTC(
            current.getUTCFullYear() + direction,
            current.getUTCMonth(),
            1,
          ),
        )
      if (view === 'month')
        return new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth() + direction,
            1,
          ),
        )
      return addDays(
        current,
        direction * (view === 'week' ? 7 : view === 'four-day' ? 4 : 1),
      )
    })
  }

  return (
    <div className="landing-preview">
      <div className="landing-preview-toolbar">
        <div className="landing-preview-name">
          <CalendarDays aria-hidden="true" />
          <span>View explorer</span>
        </div>
        <div
          className="landing-view-controls"
          role="group"
          aria-label="Calendar preview view"
        >
          {PREVIEW_VIEWS.map((item) => (
            <button
              type="button"
              key={item.value}
              aria-pressed={view === item.value}
              onClick={() => setView(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="landing-preview-datebar">
        <h3 aria-live="polite" aria-atomic="true">
          {heading}
        </h3>
        <div>
          <button
            type="button"
            aria-label="Previous period"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            className="landing-preview-today"
            type="button"
            onClick={() => setDate(new Date(`${today}T00:00:00Z`))}
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next period"
            onClick={() => navigate(1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        className="landing-preview-canvas"
        role="region"
        aria-label={`${selected.label} view illustration`}
        tabIndex={0}
      >
        {view === 'year' ? (
          <div className="landing-year-grid">
            {Array.from({ length: 12 }, (_, month) => {
              const monthDate = new Date(
                Date.UTC(date.getUTCFullYear(), month, 1),
              )
              return (
                <div key={month}>
                  <h4>{monthFormat.format(monthDate)}</h4>
                  <MonthGrid date={monthDate} today={today} compact />
                </div>
              )
            })}
          </div>
        ) : view === 'month' ? (
          <MonthGrid date={date} today={today} />
        ) : (
          <TimeGrid
            date={date}
            today={today}
            count={view === 'week' ? 7 : view === 'four-day' ? 4 : 1}
          />
        )}
      </div>
      <div className="landing-preview-caption">
        <p aria-live="polite" aria-atomic="true">
          {selected.description}
        </p>
        <span>Illustrated preview · No event data</span>
      </div>
      <a
        className="landing-preview-guide"
        href="https://xyehr.cn/docs/calendar/views"
      >
        Learn about calendar views <ArrowUpRight aria-hidden="true" />
      </a>
    </div>
  )
}
