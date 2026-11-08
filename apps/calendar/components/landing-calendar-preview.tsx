'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  PanelLeft,
  Plus,
  Search,
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
import WeekView from '@zntr/shared/calendar/components/views/week-view'
import {
  CalendarViewType,
  FirstDayOfWeek,
  Language,
  TimeFormat,
  ViewConfig,
  type CalendarEvent,
} from '@zntr/shared/calendar/lib/calendar-types'
import {
  DEMO_CATEGORIES,
  landingDemoDate,
  landingDemoEvents,
} from '@/lib/landing-demo'

const MonthView = dynamic(
  () => import('@zntr/shared/calendar/components/views/month-view'),
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
export function LandingCalendarPreview({
  interactive = true,
}: { interactive?: boolean } = {}) {
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
    <div
      className="landing-demo"
      style={
        interactive ? undefined : { pointerEvents: 'none', userSelect: 'none' }
      }
      aria-hidden={interactive ? undefined : true}
    >
      <div className="landing-demo-workspace">
        <aside
          className="landing-demo-sidebar"
          aria-label="Sample calendar filters"
        >
          <div className="p-4">
            <div className="mb-3 flex items-center">
              <img
                src="/logo-light.svg"
                alt=""
                width={28}
                height={28}
                className="mr-2 size-7 shrink-0"
              />
              <h2 className="select-none text-lg font-semibold">
                Zentra Calendar
              </h2>
            </div>
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="mb-4 h-10 w-full justify-center"
            >
              <Link href="/sign-up">
                <Plus aria-hidden="true" />
                New event
              </Link>
            </Button>
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
              disabled={!interactive}
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
          <header className="landing-demo-toolbar">
            <div className="flex min-w-0 items-center space-x-4 max-md:space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 max-md:hidden"
                aria-label="Toggle sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 max-md:hidden"
                onClick={() => {
                  setDate(landingDemoDate())
                  setCategory('all')
                  setView('week')
                }}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 md:hidden"
                aria-label="Today"
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
              <div className="flex shrink-0 items-center space-x-1 max-md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous period"
                  disabled={!interactive}
                  onClick={() => navigate(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next period"
                  disabled={!interactive}
                  onClick={() => navigate(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <h2
                aria-live="polite"
                aria-atomic="true"
                className="min-w-0 truncate text-lg max-md:text-base"
              >
                {format(date, 'MMMM yyyy')}
              </h2>
            </div>
            <div className="ml-auto flex shrink-0 items-center space-x-2">
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
                    disabled={!interactive}
                    onClick={() => setView(value)}
                  >
                    {value === 'week' ? 'Week' : 'Month'}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-8 w-8"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!interactive}
                onClick={() => {
                  setDate(landingDemoDate())
                  setCategory('all')
                  setView('week')
                }}
              >
                Reset demo
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-8 w-8 max-md:hidden"
                aria-label="Help"
              >
                <CircleHelp className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <div
            className="landing-demo-scroll"
            role="region"
            aria-label="Interactive sample calendar"
            tabIndex={interactive ? 0 : -1}
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
        <div className="landing-demo-rail" aria-hidden="true">
          <span className="landing-demo-rail-btn">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />
            </svg>
          </span>
          <span className="landing-demo-rail-btn">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </span>
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
