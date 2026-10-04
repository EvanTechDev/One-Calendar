/**
 * The month view's "N more events" list and the event preview opened from one
 * of its rows.
 *
 * The bug: opening an event's preview and then closing it also closed the
 * list. Radix gives each popover its own dismissable layer, and the preview is
 * PORTALLED to `<body>` — so from the list's layer, pressing the preview's own
 * close button was an interaction "outside" the list, and both the pointerdown
 * and the focus move that button causes end at `onInteractOutside`. Same bug in
 * the year view's per-day list.
 *
 * What must hold, and is pinned here:
 *  - interacting INSIDE the preview leaves the list open (the preview is a
 *    child of the list, not an outside click);
 *  - closing the preview leaves the list open, and the list is still usable;
 *  - an interaction outside BOTH still closes the list — the exemption is
 *    narrow, not a blanket "the list can no longer be dismissed".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { useState, useRef } from 'react'
import MonthView from '@/components/app/views/month-view'
import YearView from '@/components/app/views/year-view'
import { useEventPreviewNavigation } from '@/hooks/use-event-preview-navigation'
import EventPreview from '@/components/app/event/event-preview'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  Language,
  FirstDayOfWeek,
  ViewConfig,
  TimeFormat,
} from '@/lib/calendar-types'

vi.mock('sonner', () => ({
  toast: Object.assign((...args: unknown[]) => void args, {
    error: (...args: unknown[]) => void args,
    success: (...args: unknown[]) => void args,
    warning: (...args: unknown[]) => void args,
  }),
}))

vi.mock('@/components/providers/calendar-context', () => ({
  useCalendar: () => ({ calendars: [], events: [] }),
}))

vi.mock('@/components/providers/data-provider', () => ({
  useBookmarks: () => ({
    bookmarks: [],
    createBookmark: vi.fn(),
    deleteBookmark: vi.fn(),
  }),
}))

vi.mock('@/lib/auth/client', () => ({
  authClient: { useSession: () => ({ data: null }) },
}))

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

function NavigationHarness({
  view,
  onReady,
}: {
  view: 'month' | 'year'
  onReady: (anchor: HTMLElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [target, setTarget] = useState<CalendarEvent | null>(null)
  useEventPreviewNavigation(target, ref, onReady)
  return (
    <>
      <button onClick={() => setTarget(EVENTS[3])}>Open search result</button>
      <div ref={ref}>
        {view === 'month' ? (
          <MonthView
            date={config.date}
            events={EVENTS}
            config={config}
            onEventClick={vi.fn()}
            onDayNumberClick={vi.fn()}
            onCellClick={vi.fn()}
          />
        ) : (
          <YearView
            date={config.date}
            events={EVENTS}
            config={config}
            onEventClick={vi.fn()}
            onDayHeaderClick={vi.fn()}
          />
        )}
      </div>
    </>
  )
}

describe('search/bookmark preview navigation', () => {
  it.each(['month', 'year'] as const)(
    '%s reveals the list before anchoring to its event row',
    async (view) => {
      const onReady = vi.fn()
      const scroll = vi.fn()
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: scroll,
      })
      render(<NavigationHarness view={view} onReady={onReady} />)
      expect(document.querySelector('[data-event-id="e4"]')).toBeNull()
      fireEvent.click(screen.getByText('Open search result'))
      const row = await screen.findByRole('button', { name: 'Event 4' })
      await waitFor(() => expect(onReady).toHaveBeenCalledWith(row))
      expect(row.closest('[data-slot="popover-content"]')).not.toBeNull()
      // Reveal the calendar date in a comfortable part of the viewport BEFORE
      // opening its fixed-position portal. Nearest left it against the edge.
      expect(scroll.mock.calls[0][0]).toMatchObject({ block: 'center' })
      expect(scroll.mock.contexts[0]).toBe(
        document.querySelector('[data-event-reveal-date="2025-01-15"]'),
      )
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
    },
  )
})

/** MonthView wired to a real EventPreview, the way calendar.tsx wires them. */
function Harness() {
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null)
  return (
    <>
      <MonthView
        date={new Date(2025, 0, 15)}
        events={EVENTS}
        onEventClick={(event) => setPreviewEvent(event)}
        // Required by the props. This harness never clicks a cell, but
        // omitting them throws the moment anything does — silently, in a file
        // whose subject is a different component.
        onDayNumberClick={() => {}}
        onCellClick={() => {}}
        config={config}
      />
      {previewEvent && (
        <EventPreview
          event={previewEvent}
          open
          onOpenChange={(open) => {
            if (!open) setPreviewEvent(null)
          }}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          _onDuplicate={vi.fn()}
          language={'en' as never}
          _timezone="UTC"
        />
      )}
    </>
  )
}

/** The list popover shows the two events the cell had no room for. */
const listRows = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('[data-slot="popover-content"]'),
  ).flatMap((content) =>
    Array.from(content.querySelectorAll<HTMLElement>('button')).filter((b) =>
      b.textContent?.startsWith('Event '),
    ),
  )

const previewIsOpen = () =>
  document.querySelectorAll('[data-child-overlay]').length > 0

/**
 * Radix arms its outside-pointerdown listener on a `setTimeout(0)`, so a test
 * that fires immediately after mount races it and dismisses nothing.
 */
async function tick() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
}

async function openListAndPreview() {
  render(<Harness />)
  fireEvent.click(screen.getByText('2 more events'))
  await tick()
  expect(listRows()).toHaveLength(2)

  fireEvent.click(screen.getByRole('button', { name: /Event 4/ }))
  await tick()
  expect(previewIsOpen()).toBe(true)
}

/** The preview's ✕ is the last button in its header row. */
const previewCloseButton = () => {
  const preview = document.querySelector<HTMLElement>('[data-child-overlay]')
  if (!preview) throw new Error('preview is not open')
  const buttons = preview.querySelectorAll<HTMLElement>(
    ':scope > div:first-child button',
  )
  return buttons[buttons.length - 1]
}

/** A full pointer press at `el`: pointerdown is what Radix dismisses on. */
function press(el: Element) {
  fireEvent.pointerDown(el)
  fireEvent.click(el)
}

describe('month view "more events" list with a nested event preview', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('tags the preview content so a parent list can recognise it', async () => {
    await openListAndPreview()
    // The contract is the DOM attribute: the list cannot see the preview's
    // React tree (it is portalled to <body>), only its markup.
    expect(previewIsOpen()).toBe(true)
  })

  it('stays open when the interaction happens inside the preview', async () => {
    await openListAndPreview()

    // The preview's title — an inert element, so this isolates the dismissal
    // behaviour from anything the preview's own buttons do.
    const title = screen.getByRole('heading', { name: 'Event 4' })
    press(title)

    await tick()
    expect(previewIsOpen()).toBe(true)
    expect(listRows()).toHaveLength(2)
  })

  it('stays open when the preview is closed from its own close button', async () => {
    await openListAndPreview()

    const row = screen.getByRole('button', { name: /Event 4/ })
    // A real click focuses the row, so focus restore lands back inside the
    // list rather than on <body> (which would read as focus leaving it).
    row.focus()
    press(previewCloseButton())

    await tick()
    expect(previewIsOpen()).toBe(false)
    expect(listRows()).toHaveLength(2)
  })

  it('still dismisses for an interaction outside both surfaces', async () => {
    await openListAndPreview()

    press(document.body)

    await tick()
    expect(listRows()).toHaveLength(0)
  })
})
