import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNotifications } from '@/components/app/hooks/useNotifications'
import type { CalendarEvent } from '@/components/app/calendar'

const checkPendingNotifications = vi.hoisted(() => vi.fn())

vi.mock('@/lib/notifications', () => ({ checkPendingNotifications }))

function event(id: string): CalendarEvent {
  return {
    id,
    title: id,
    startDate: new Date('2026-08-22T12:00:00.000Z'),
    endDate: new Date('2026-08-22T12:30:00.000Z'),
    isAllDay: false,
    participants: [],
    notification: 15,
    color: '#3B82F6',
    calendarId: '',
  }
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    checkPendingNotifications.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('checks once on mount', () => {
    renderHook(() => useNotifications([event('a')]))
    expect(checkPendingNotifications).toHaveBeenCalledTimes(1)
  })

  it('keeps polling after the events array changes', () => {
    // The regression this plan exists for: the old hook cleared its interval on
    // re-run without nulling the ref it guarded on, so polling died as soon as
    // `events` changed — which SWR causes almost immediately.
    const { rerender } = renderHook(({ events }) => useNotifications(events), {
      initialProps: { events: [event('a')] },
    })
    checkPendingNotifications.mockClear()

    rerender({ events: [event('a'), event('b')] })
    vi.advanceTimersByTime(60_000)
    expect(checkPendingNotifications).toHaveBeenCalled()

    vi.advanceTimersByTime(60_000)
    expect(checkPendingNotifications.mock.calls.length).toBeGreaterThanOrEqual(
      2,
    )
  })

  it('polls with the latest events, not a stale array', () => {
    const { rerender } = renderHook(({ events }) => useNotifications(events), {
      initialProps: { events: [event('a')] },
    })

    const next = [event('a'), event('b')]
    rerender({ events: next })
    checkPendingNotifications.mockClear()

    vi.advanceTimersByTime(60_000)
    expect(checkPendingNotifications).toHaveBeenCalledWith(next)
  })

  it('stops polling once unmounted', () => {
    const { unmount } = renderHook(() => useNotifications([event('a')]))
    unmount()
    checkPendingNotifications.mockClear()

    vi.advanceTimersByTime(180_000)
    expect(checkPendingNotifications).not.toHaveBeenCalled()
  })
})
