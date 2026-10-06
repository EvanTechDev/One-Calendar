import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '../host-render'
import EventEditor from '@/components/app/event/event-editor'
import type { CalendarEvent } from '@/lib/calendar-types'
import {
  Language,
  FirstDayOfWeek,
  ViewConfig,
  TimeFormat,
} from '@/lib/calendar-types'

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_AI_ENABLED = '1'
})

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
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
  vi.unstubAllGlobals()
})

function chooseOption(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: label }), {
    key: 'ArrowDown',
  })
  fireEvent.click(screen.getByRole('option', { name: option }))
}

describe('editing recurrence from an occurrence', () => {
  it('projects an AI-filled instant into the editor timezone and preserves duration when saving', async () => {
    const onAdd = vi.fn()
    const initialDate = new Date('2026-10-06T08:00:00Z')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          event: { title: 'Parsed meeting', start: '2026-10-07T09:00:00Z' },
        }),
      }),
    )
    const view = render(
      <EventEditor
        open
        onOpenChange={vi.fn()}
        onEventAdd={onAdd}
        onEventUpdate={vi.fn()}
        onEventDelete={vi.fn()}
        onInvitesAdded={vi.fn()}
        initialDate={initialDate}
        initialEndDate={new Date('2026-10-06T09:00:00Z')}
        config={ViewConfig.create({
          date: initialDate,
          timezone: 'America/New_York',
          timeFormat: TimeFormat.h24(),
          firstDayOfWeek: FirstDayOfWeek.sunday(),
          language: new Language('en'),
        })}
      />,
    )
    expect(screen.getByRole('button', { name: '04:00' })).toBeInTheDocument()
    const title = view.baseElement.querySelector('#title')!
    fireEvent.change(title, { target: { value: 'Meeting tomorrow' } })
    fireEvent.keyDown(title, { key: 'Enter' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '05:00' })).toBeEnabled(),
    )
    expect(screen.getByRole('button', { name: '06:00' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: new Date('2026-10-07T09:00:00Z'),
        endDate: new Date('2026-10-07T10:00:00Z'),
      }),
    )
  })
  it('updates date and time fields when the calendar timezone changes, without changing the saved instant', () => {
    const onUpdate = vi.fn()
    const event: CalendarEvent = {
      id: 'zone-event',
      title: 'Timezone event',
      startDate: new Date('2026-10-06T08:00:00Z'),
      endDate: new Date('2026-10-06T09:00:00Z'),
      isAllDay: false,
      participants: [],
      notification: null,
      description: '',
      location: '',
      color: '',
      calendarId: '',
    }
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      onEventAdd: vi.fn(),
      onEventUpdate: onUpdate,
      onEventDelete: vi.fn(),
      onInvitesAdded: vi.fn(),
      initialDate: event.startDate,
      event,
    }
    const zoneConfig = (timezone: string) =>
      ViewConfig.create({
        date: start,
        timezone,
        timeFormat: TimeFormat.h24(),
        firstDayOfWeek: FirstDayOfWeek.sunday(),
        language: new Language('en'),
      })
    const view = render(
      <EventEditor {...props} config={zoneConfig('Asia/Shanghai')} />,
    )
    expect(screen.getByRole('button', { name: '16:00' })).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue('Timezone event'), {
      target: { value: 'Unsaved title' },
    })
    view.rerender(
      <EventEditor {...props} config={zoneConfig('America/New_York')} />,
    )
    expect(screen.getByRole('button', { name: '04:00' })).toBeInTheDocument()
    view.rerender(<EventEditor {...props} config={zoneConfig('Etc/GMT+11')} />)
    expect(screen.getByRole('button', { name: '21:00' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '2026-10-05' })).toHaveLength(
      2,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Unsaved title',
        startDate: event.startDate,
        endDate: event.endDate,
      }),
      undefined,
    )
  })

  it.each([
    {
      name: 'all-day exclusive end',
      timezone: 'Etc/GMT+11',
      isAllDay: true,
      from: new Date(2026, 9, 6),
      to: new Date(2026, 9, 7),
    },
    {
      name: 'DST fold and seconds',
      timezone: 'America/New_York',
      isAllDay: false,
      from: new Date('2026-11-01T05:30:12.123Z'),
      to: new Date('2026-11-01T06:15:34.567Z'),
    },
  ])('preserves $name on a no-op save', ({ timezone, isAllDay, from, to }) => {
    const onUpdate = vi.fn()
    const event: CalendarEvent = {
      id: 'unchanged',
      title: 'Keep dates',
      startDate: from,
      endDate: to,
      isAllDay,
      participants: [],
      notification: null,
      color: '',
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
        initialDate={from}
        event={event}
        config={ViewConfig.create({
          date: from,
          timezone,
          timeFormat: TimeFormat.h24(),
          firstDayOfWeek: FirstDayOfWeek.sunday(),
          language: new Language('en'),
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: from, endDate: to }),
      undefined,
    )
  })

  it('keeps COUNT unchanged in the editor payload when choosing this and following', () => {
    const onUpdate = vi.fn()
    const event: CalendarEvent = {
      id: 'count_20261006T080000Z',
      seriesId: 'count',
      recurrenceId: '20261006T080000Z',
      seriesStartDate: new Date('2026-10-05T08:00:00Z'),
      rrule: 'FREQ=DAILY;COUNT=3',
      title: 'Three days',
      startDate: new Date('2026-10-06T08:00:00Z'),
      endDate: new Date('2026-10-06T09:00:00Z'),
      isAllDay: false,
      participants: [],
      notification: null,
      color: '',
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
        initialDate={event.startDate}
        event={event}
        config={config}
      />,
    )
    chooseOption('Repeat scope', 'This and following')
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Update',
      }),
    )
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: event.startDate,
        endDate: event.endDate,
        rrule: 'FREQ=DAILY;INTERVAL=1;COUNT=3',
        seriesStartDate: event.seriesStartDate,
      }),
      'following',
    )
  })

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
    chooseOption('Repeat scope', first ? 'All events' : 'This and following')
    const interval = screen.getAllByRole('spinbutton')[0]
    expect(interval).toHaveValue(1)
    fireEvent.change(interval, { target: { value: '2' } })
    expect(screen.queryByText(/FREQ=/)).toBeNull()
    expect(screen.getByText(/Every 2 weeks/)).toBeInTheDocument()
    chooseOption('Ends', 'Never')
    expect(screen.getByRole('combobox', { name: 'Ends' })).toHaveTextContent(
      'Never',
    )
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1)
    chooseOption('Ends', 'Count')
    expect(screen.getByRole('combobox', { name: 'Ends' })).toHaveTextContent(
      'Count',
    )
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2)
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
