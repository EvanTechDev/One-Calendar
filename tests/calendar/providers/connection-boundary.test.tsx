import { useEffect, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  CalendarHostProvider,
  useCalendarHost,
  type CalendarHost,
} from '@zntr/utils/calendar-host'
import { ConnectionBoundary } from '@zntr/ui/calendar/components/connection-boundary'

function fixture(request: typeof fetch, mounted: () => void) {
  const host: CalendarHost = {
    platform: 'web',
    request,
    session: {
      data: { user: { id: 'user', name: 'Alex', email: 'alex@example.com' } },
      isPending: false,
    },
    navigation: { push: vi.fn(), replace: vi.fn(), openExternal: vi.fn() },
  }
  function Editor() {
    const { request: send, session } = useCalendarHost()
    const [title, setTitle] = useState('Unfinished draft')
    useEffect(mounted, [])
    return (
      <>
        <input
          aria-label="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <p>{session.data?.user.name}</p>
        <button onClick={() => void send('/api/events').catch(() => {})}>
          Load
        </button>
      </>
    )
  }
  return render(
    <CalendarHostProvider value={host}>
      <ConnectionBoundary>
        <Editor />
      </ConnectionBoundary>
    </CalendarHostProvider>,
  )
}

describe('shared connection recovery', () => {
  it('preserves the mounted editor and identity across failed requests and reconnect', async () => {
    let connected = false
    const request = vi.fn(async () => {
      if (!connected) throw new TypeError('Failed to fetch')
      return new Response(null, { status: 204 })
    })
    const mounted = vi.fn()
    const view = fixture(request, mounted)
    const input = screen.getByLabelText('Event title')
    fireEvent.change(input, { target: { value: 'Keep this draft' } })
    fireEvent.click(screen.getByText('Load'))
    await screen.findByRole('heading', { name: 'No internet connection' })
    expect(input.closest('[inert]')).not.toBeNull()
    connected = true
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'No internet connection' }),
      ).toBeNull(),
    )
    expect(screen.getByLabelText('Event title')).toBe(input)
    expect(input).toHaveValue('Keep this draft')
    expect(screen.getByText('Alex')).toBeVisible()
    expect(mounted).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenLastCalledWith('/api/connection', {
      cache: 'no-store',
    })
    view.unmount()
  })

  it('does not turn cancellation or an HTTP authentication response into disconnection', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    const view = fixture(request, vi.fn())
    await act(async () => {
      fireEvent.click(screen.getByText('Load'))
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Load'))
    })
    expect(
      screen.queryByRole('heading', { name: 'No internet connection' }),
    ).toBeNull()
    view.unmount()
  })

  it('uses offline/online signals to cover lost connectivity without a calendar request', async () => {
    const view = fixture(
      vi.fn(async () => new Response(null, { status: 204 })),
      vi.fn(),
    )
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(
      screen.getByRole('heading', { name: 'No internet connection' }),
    ).toBeVisible()
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(
      screen.queryByRole('heading', { name: 'No internet connection' }),
    ).toBeNull()
    view.unmount()
  })
})
