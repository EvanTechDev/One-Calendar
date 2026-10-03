import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import EventEditor from '@/components/app/event/event-editor'
import type { CalendarEvent } from '@/components/app/calendar'
import {
  Language,
  FirstDayOfWeek,
  ViewConfig,
  TimeFormat,
} from '@/lib/calendar-types'

vi.mock('@/components/providers/calendar-context', () => {
  const state = { calendars: [], events: [] }
  return { useCalendar: () => state }
})
vi.mock('@/hooks/use-event-meeting-draft', () => ({
  useEventMeetingDraft: () => ({ meeting: null, keep: vi.fn() }),
}))
vi.mock('@/components/app/event/event-meeting-field', () => ({
  EventMeetingField: () => null,
}))
// jsdom has no layout. Keep the real form and scope dialogs, but freeze the
// live positioning hook so Radix's layout effects cannot chase zero rects.
vi.mock('@/hooks/use-anchored-popover', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-anchored-popover')>()),
  useLiveAnchorRect: () => null,
}))

const start = new Date('2026-10-05T09:00:00Z')
const config = ViewConfig.create({
  date: start,
  timezone: 'UTC',
  timeFormat: TimeFormat.h24(),
  firstDayOfWeek: FirstDayOfWeek.sunday(),
  language: new Language('en'),
})

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('editing recurrence from an occurrence', () => {
  it.each([
    { first: true, scope: 'all' },
    { first: false, scope: 'following' },
  ] as const)('allows changing the rule for $scope', ({ first, scope }) => {
    const onUpdate = vi.fn()
    const event: CalendarEvent = {
      id: 'm1_20261005T090000Z',
      seriesId: 'm1',
      recurrenceId: '20261005T090000Z',
      isFirstInstance: first,
      rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=8',
      title: 'Team sync',
      startDate: start,
      endDate: new Date('2026-10-05T09:30:00Z'),
      isAllDay: false,
      participants: [],
      notification: null,
      description: '',
      location: '',
      color: 'bg-[#E6F6FD]',
      calendarId: '',
    }
    render(
      <EventEditor
        open
        onOpenChange={vi.fn()}
        onEventAdd={vi.fn()}
        onEventUpdate={onUpdate}
        onEventDelete={vi.fn()}
        onInvitesAdded={vi.fn()}
        initialDate={start}
        event={event}
        config={config}
      />,
    )

    expect(screen.queryByRole('spinbutton')).toBeNull()
    fireEvent.click(document.getElementById('edit-scope-series')!)
    const interval = screen.getAllByRole('spinbutton')[0]
    expect(interval).toHaveValue(1)
    fireEvent.change(interval, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    const confirmation = screen.getByRole('alertdialog')
    fireEvent.click(
      within(confirmation).getByRole('button', { name: 'Update' }),
    )
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        rrule: 'FREQ=WEEKLY;INTERVAL=2;COUNT=8;BYDAY=MO',
      }),
      scope,
    )
  })
})
