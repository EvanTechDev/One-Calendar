'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { addDays, addMonths, format } from 'date-fns'
import { Button } from '@zntr/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@zntr/ui/dialog'
import WeekView from '@zntr/calendar/components/views/week-view'
import {
  CalendarViewType,
  FirstDayOfWeek,
  Language,
  TimeFormat,
  ViewConfig,
  type CalendarEvent,
} from '@zntr/calendar/lib/calendar-types'
import {
  DEMO_CATEGORIES,
  landingDemoDate,
  landingDemoEvents,
} from '@/lib/landing-demo'

const MonthView = dynamic(
  () => import('@zntr/calendar/components/views/month-view'),
  { loading: () => <p className="landing-demo-loading">Loading month…</p> },
)

const eventTime = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
})

// The same views used by the signed-in app, with an isolated sample dataset.
// No account providers are mounted: this demo cannot fetch or save user data.
export function LandingCalendarPreview() {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [date, setDate] = useState(landingDemoDate)
  const [category, setCategory] = useState('all')
  const [events] = useState(landingDemoEvents)
  const [open, setOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [creating, setCreating] = useState(false)
  const config = useMemo(
    () =>
      ViewConfig.create({
        date,
        timezone: 'UTC',
        timeFormat: TimeFormat.h12(),
        firstDayOfWeek: FirstDayOfWeek.monday(),
        language: Language.create('en'),
        viewType: CalendarViewType.create(view),
      }),
    [date, view],
  )
  const visibleEvents =
    category === 'all'
      ? events
      : events.filter((event) => event.calendarId === category)

  function showEvent(event: CalendarEvent) {
    setSelectedEvent(event)
    setCreating(false)
    setOpen(true)
  }

  function showEvents() {
    setSelectedEvent(null)
    setCreating(false)
    setOpen(true)
  }

  function showCreate() {
    setSelectedEvent(null)
    setCreating(true)
    setOpen(true)
  }

  function showWeek(day: Date) {
    setDate(day)
    setView('week')
  }

  function navigate(direction: number) {
    setDate((current) =>
      view === 'month'
        ? addMonths(
            new Date(current.getFullYear(), current.getMonth(), 1),
            direction,
          )
        : addDays(current, direction * 7),
    )
  }

  return (
    <div className="landing-demo">
      <div className="landing-demo-workspace">
        <aside
          className="landing-demo-sidebar"
          aria-label="Sample calendar filters"
        >
          <div className="landing-demo-identity">
            <img src="/logo-light.svg" alt="" width={24} height={24} />
            <span>My calendar</span>
          </div>
          <span className="landing-demo-sidebar-label">Workspace preview</span>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="landing-demo-new"
          >
            <Link href="/sign-up">
              <Plus aria-hidden="true" />
              New event
            </Link>
          </Button>
          <p className="landing-demo-sidebar-label">Categories</p>
          {[
            { id: 'all', label: 'All events', color: '#9296a1' },
            ...DEMO_CATEGORIES,
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className="landing-demo-category"
              aria-pressed={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              <span
                className="landing-demo-category-check"
                style={{ backgroundColor: item.color }}
              >
                {category === item.id ? <Check aria-hidden="true" /> : null}
              </span>
              {item.label}
            </button>
          ))}
          <div className="landing-demo-sidebar-note">
            <CalendarDays aria-hidden="true" />
            <p>A week of possibilities.</p>
            <span>
              Example events. Your calendar starts with your own plans.
            </span>
          </div>
        </aside>
        <div className="landing-demo-main">
          <div className="landing-demo-toolbar">
            <h2 aria-live="polite" aria-atomic="true">
              {format(date, 'MMMM yyyy')}
            </h2>
            <div className="landing-demo-period">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous period"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next period"
                onClick={() => navigate(1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDate(landingDemoDate())
                  setCategory('all')
                  setView('week')
                }}
              >
                Reset demo
              </Button>
            </div>
            <div
              className="landing-demo-views"
              role="group"
              aria-label="Sample calendar view"
            >
              {(['week', 'month'] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={view === value ? 'secondary' : 'ghost'}
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                >
                  {value === 'week' ? 'Week' : 'Month'}
                </Button>
              ))}
            </div>
          </div>
          <div
            className="landing-demo-scroll"
            role="region"
            aria-label="Interactive sample calendar"
            tabIndex={0}
          >
            <div className="landing-demo-view">
              {view === 'month' ? (
                <MonthView
                  date={date}
                  events={visibleEvents}
                  config={config}
                  appearance="light"
                  onEventClick={showEvent}
                  onDayNumberClick={showWeek}
                  onCellClick={showCreate}
                />
              ) : (
                <WeekView
                  date={date}
                  events={visibleEvents}
                  config={config}
                  appearance="light"
                  initialScrollHour={8}
                  onEventClick={showEvent}
                  onDayHeaderClick={showEvents}
                  onTimeSlotClick={showCreate}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="landing-demo-caption">
        <span>
          <span className="landing-status-dot" />
          Sample schedule · Nov 2–8, 2026 · UTC
        </span>
        <Button size="sm" variant="ghost" onClick={showEvents}>
          Browse sample events
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {creating
                ? 'Make your first event'
                : (selectedEvent?.title ?? 'Sample schedule')}
            </DialogTitle>
            <DialogDescription>
              {creating
                ? 'Create an account to add your own events. This preview does not save changes.'
                : 'These are fictional example events, not a real person’s calendar.'}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent ? (
            <div className="space-y-2 text-sm">
              <p>{eventTime.format(selectedEvent.startDate)} · UTC</p>
              <p>
                {
                  DEMO_CATEGORIES.find(
                    (item) => item.id === selectedEvent.calendarId,
                  )?.label
                }
              </p>
            </div>
          ) : !creating ? (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {visibleEvents.map((event) => (
                <Button
                  key={event.id}
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-between gap-4 py-2 text-left"
                  onClick={() => showEvent(event)}
                >
                  <span className="whitespace-normal">{event.title}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {eventTime.format(event.startDate)}
                  </span>
                </Button>
              ))}
            </div>
          ) : null}
          <Button asChild size="sm" className="justify-self-start">
            <Link href="/sign-up">Create account</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
