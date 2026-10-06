import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { useRef, useState } from 'react'
import { useEventPreviewNavigation } from '@zntr/calendar-ui/hooks/use-event-preview-navigation'

afterEach(cleanup)

function Harness({
  isAllDay,
  onReady,
}: {
  isAllDay: boolean
  onReady: (anchor: HTMLElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [target] = useState({
    id: 'target',
    startDate: new Date('2025-01-15T02:00:00Z'),
    isAllDay,
  })
  const [day, setDay] = useState<string | null>(null)
  useEventPreviewNavigation(target, ref, onReady, 'Etc/GMT+11')
  const expectedDay = isAllDay ? '2025-01-15' : '2025-01-14'
  return (
    <div ref={ref}>
      {['2025-01-14', '2025-01-15'].map((date) => (
        <button
          key={date}
          data-event-reveal-date={date}
          onClick={() => setDay(date)}
        >
          {date}
        </button>
      ))}
      {day === expectedDay && <button data-event-id="target">Event</button>}
    </div>
  )
}

it.each([false, true])(
  'reveals the calendar date and anchors the event (all-day=%s)',
  async (isAllDay) => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
    const onReady = vi.fn()
    render(<Harness isAllDay={isAllDay} onReady={onReady} />)
    await waitFor(() => expect(onReady).toHaveBeenCalled(), { timeout: 3000 })
    expect(onReady.mock.calls.at(-1)?.[0]?.dataset.eventId).toBe('target')
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
  },
)
