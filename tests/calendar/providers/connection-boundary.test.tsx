await import('./../../support/dom')
const { useEffect, useState } = await import('react')
const { act, fireEvent, render, screen, waitFor } =
  await import('@testing-library/react')
import { describe, expect, it, vi } from 'bun:test'
const { CalendarHostProvider, useCalendarHost } =
  await import('@zntr/utils/calendar-host')
import type { CalendarHost } from '@zntr/utils/calendar-host'
const { ConnectionBoundary } =
  await import('@zntr/ui/calendar/components/connection-boundary')
const { Dialog, DialogContent, DialogTitle } = await import('@zntr/ui/dialog')
const { Popover, PopoverContent, PopoverTrigger } =
  await import('@zntr/ui/popover')

function fixture(
  request: typeof fetch,
  mounted: () => void,
  portal?: 'dialog' | 'popover',
  checkConnection?: () => Promise<boolean>,
  onReconnect?: () => void | Promise<void>,
) {
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
  function PortalledEditor() {
    const [open, setOpen] = useState(true)
    if (portal === 'dialog')
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Edit event</DialogTitle>
            <Editor />
          </DialogContent>
        </Dialog>
      )
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>Edit event</PopoverTrigger>
        <PopoverContent>
          <Editor />
        </PopoverContent>
      </Popover>
    )
  }
  return render(
    <CalendarHostProvider value={host}>
      <ConnectionBoundary
        checkConnection={checkConnection}
        onReconnect={onReconnect}
      >
        {portal ? <PortalledEditor /> : <Editor />}
      </ConnectionBoundary>
    </CalendarHostProvider>,
  )
}

describe('shared connection recovery', () => {
  it('does not claim an outage while the initial desktop probe is pending', async () => {
    let resolveProbe: (connected: boolean) => void = () => {}
    const checkConnection = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveProbe = resolve
        }),
    )
    const view = fixture(vi.fn(), vi.fn(), undefined, checkConnection)

    expect(
      screen.queryByRole('heading', { name: 'No internet connection' }),
    ).toBeNull()
    expect(view.container.querySelector('[inert]')).toBeNull()

    await act(async () => resolveProbe(false))
    expect(
      screen.getByRole('heading', { name: 'No internet connection' }),
    ).toBeVisible()
    view.unmount()
  })

  it('reveals desktop content after the initial connection probe succeeds', async () => {
    let resolveProbe: (connected: boolean) => void = () => {}
    const checkConnection = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveProbe = resolve
        }),
    )
    const view = fixture(vi.fn(), vi.fn(), undefined, checkConnection)

    expect(
      screen.queryByRole('heading', { name: 'No internet connection' }),
    ).toBeNull()
    await act(async () => resolveProbe(true))
    expect(
      screen.queryByRole('heading', { name: 'No internet connection' }),
    ).toBeNull()
    expect(view.container.querySelector('[inert]')).toBeNull()
    view.unmount()
  })

  it.each(['dialog', 'popover'] as const)(
    'keeps a portalled %s draft open while recovery takes focus',
    async (portal) => {
      let connected = false
      const request = vi.fn(async () => {
        if (!connected) throw new TypeError('Failed to fetch')
        return new Response(null, { status: 204 })
      })
      const mounted = vi.fn()
      const view = fixture(request, mounted, portal)
      const input = await screen.findByLabelText('Event title')
      fireEvent.change(input, { target: { value: 'Keep portalled draft' } })
      fireEvent.click(screen.getByText('Load'))
      const retry = await screen.findByRole('button', { name: 'Try again' })
      act(() => {
        retry.focus()
      })
      expect(retry).toHaveFocus()
      // Real document-level Radix outside handlers receive these pointer events.
      fireEvent.pointerDown(retry, { pointerType: 'mouse', button: 0 })
      fireEvent.pointerUp(retry, { pointerType: 'mouse', button: 0 })
      connected = true
      fireEvent.click(retry)
      await waitFor(() =>
        expect(
          screen.queryByRole('heading', { name: 'No internet connection' }),
        ).toBeNull(),
      )
      expect(screen.getByLabelText('Event title')).toBe(input)
      expect(input).toHaveValue('Keep portalled draft')
      expect(mounted).toHaveBeenCalledTimes(1)
      view.unmount()
    },
  )

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

  it('confirms connectivity before treating a native request rejection as an outage', async () => {
    const check = vi.fn(async () => true)
    const view = fixture(
      vi.fn(async () => {
        throw new Error('The account changed during this request')
      }),
      vi.fn(),
      undefined,
      check,
    )
    await act(async () => {
      fireEvent.click(screen.getByText('Load'))
    })
    expect(check).toHaveBeenCalledTimes(2)
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

  it('does not turn a session refresh failure into an outage after a successful probe', async () => {
    const onReconnect = vi.fn(async () => {
      throw new Error('Session expired')
    })
    const view = fixture(
      vi.fn(),
      vi.fn(),
      undefined,
      async () => true,
      onReconnect,
    )
    await act(async () => {})
    act(() => window.dispatchEvent(new Event('offline')))
    await act(async () => window.dispatchEvent(new Event('online')))
    expect(onReconnect).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('heading', { name: 'No internet connection' }),
    ).toBeNull()
    expect(view.container.querySelector('[inert]')).toBeNull()
    view.unmount()
  })

  it('distinguishes a reachable server error from an internet outage during recovery', async () => {
    const view = fixture(
      vi.fn(async () => new Response(null, { status: 503 })),
      vi.fn(),
    )
    act(() => window.dispatchEvent(new Event('offline')))
    expect(
      screen.getByRole('heading', { name: 'No internet connection' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'No internet connection' }),
      ).toBeNull(),
    )
    expect(screen.getByLabelText('Event title')).toHaveValue('Unfinished draft')
    view.unmount()
  })
})
