await import('./../../support/dom')
const { useEffect, useState } = await import('react')
const { act, fireEvent, render, screen, waitFor } =
  await import('@testing-library/react')
import { afterEach, describe, expect, it, mock, vi } from 'bun:test'
const calendarI18n = await import('@zntr/i18n/calendar')
mock.module('@zntr/i18n/calendar', () => ({
  ...calendarI18n,
  useLanguage: () => ['en', () => {}],
}))
const { CalendarHostProvider, useCalendarHost } =
  await import('@zntr/shared/calendar/host')
import type { CalendarHost } from '@zntr/shared/calendar/host'
const { ConnectionBoundary, useCalendarConnection } =
  await import('@zntr/shared/calendar/components/connection-boundary')
const { DataProvider, useData } =
  await import('@zntr/shared/calendar/components/providers/data-provider')
const { SWRConfig } = await import('swr')
const { createCalendarApi } =
  await import('@zntr/shared/calendar/lib/api-client')
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

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })
}

afterEach(() => setNavigatorOnline(true))

function desktopFixture(
  request: typeof fetch,
  mounted: () => void,
  options: {
    source?: 'live' | 'cache'
    online?: boolean
    checkConnection?: () => Promise<boolean>
    onReconnect?: () => void | Promise<void>
    setOffline?: (offline: boolean) => void | Promise<void>
  } = {},
) {
  setNavigatorOnline(options.online ?? true)
  const checkConnection = options.checkConnection ?? vi.fn(async () => true)
  const onReconnect = options.onReconnect ?? vi.fn(async () => {})
  const setOffline = options.setOffline ?? vi.fn(async () => {})
  const host: CalendarHost = {
    platform: 'desktop',
    request,
    setOffline,
    session: {
      data: { user: { id: 'user', name: 'Alex', email: 'alex@example.com' } },
      isPending: false,
      source: options.source ?? 'live',
    },
    navigation: { push: vi.fn(), replace: vi.fn(), openExternal: vi.fn() },
  }
  function Editor() {
    const { request: send } = useCalendarHost()
    const connection = useCalendarConnection()
    const [title, setTitle] = useState('Unfinished draft')
    const [writeError, setWriteError] = useState('')
    useEffect(mounted, [])
    return (
      <>
        <input
          aria-label="Event title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button onClick={() => void send('/api/events').catch(() => {})}>
          Load
        </button>
        <button
          onClick={() => {
            void send('/api/events', { method: 'POST' }).catch((error) =>
              setWriteError(String(error)),
            )
          }}
        >
          Write
        </button>
        <output data-testid="connection-status">{connection.status}</output>
        <output data-testid="connection-cache">
          {String(connection.cacheAvailable)}
        </output>
        <output data-testid="connection-readonly">
          {String(connection.readOnly)}
        </output>
        <p>{writeError}</p>
      </>
    )
  }
  const view = render(
    <CalendarHostProvider value={host}>
      <ConnectionBoundary
        checkConnection={checkConnection}
        onReconnect={onReconnect}
      >
        <Editor />
      </ConnectionBoundary>
    </CalendarHostProvider>,
  )
  return { view, checkConnection, onReconnect, setOffline }
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

describe('desktop cached connection states', () => {
  it('keeps service failures distinct from device connectivity and probes live identity only after a fault', async () => {
    const checkConnection = vi.fn(async () => false)
    const setOffline = vi.fn(async () => {})
    const { view } = desktopFixture(
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
      vi.fn(),
      { checkConnection, setOffline },
    )
    expect(checkConnection).not.toHaveBeenCalled()
    expect(screen.getByTestId('connection-status')).toHaveTextContent('online')

    // Changing the property without an event must not reclassify an API error.
    setNavigatorOnline(false)
    await act(async () => fireEvent.click(screen.getByText('Load')))
    expect(
      await screen.findByRole('heading', { name: '服务暂时不可用' }),
    ).toBeVisible()
    expect(screen.queryByText('离线模式｜设备未连接网络')).toBeNull()
    expect(screen.getByTestId('connection-cache')).toHaveTextContent('false')
    expect(
      screen.queryByRole('button', { name: '进入离线模式／查看只读数据' }),
    ).toBeNull()
    expect(checkConnection).toHaveBeenCalledTimes(1)

    act(() => window.dispatchEvent(new Event('offline')))
    expect(
      screen.getByRole('heading', { name: '离线模式｜设备未连接网络' }),
    ).toBeVisible()
    expect(setOffline).toHaveBeenLastCalledWith(true)
    view.unmount()
  })

  it('starts a restored cached identity in service mode without an initial probe', async () => {
    const checkConnection = vi.fn(async () => true)
    const { view } = desktopFixture(vi.fn(), vi.fn(), {
      source: 'cache',
      checkConnection,
    })
    expect(
      screen.getByRole('heading', { name: '服务暂时不可用' }),
    ).toBeVisible()
    expect(screen.getByTestId('connection-cache')).toHaveTextContent('false')
    expect(screen.getByTestId('connection-readonly')).toHaveTextContent('true')
    expect(
      screen.queryByRole('button', { name: '进入离线模式／查看只读数据' }),
    ).toBeNull()
    expect(checkConnection).not.toHaveBeenCalled()
    view.unmount()
  })

  it('shows one prompt per fault, keeps the cached banner read-only, and resets after service recovery', async () => {
    let connected = false
    const checkConnection = vi.fn(async () => connected)
    const onReconnect = vi.fn(async () => {})
    const mounted = vi.fn()
    const request = vi.fn(
      async () =>
        new Response('{}', {
          status: 200,
          headers: { 'x-zntr-cache': 'fallback' },
        }),
    )
    const { view } = desktopFixture(request, mounted, {
      checkConnection,
      onReconnect,
    })
    const input = screen.getByLabelText('Event title')
    fireEvent.change(input, { target: { value: 'Keep cached draft' } })
    await act(async () => fireEvent.click(screen.getByText('Load')))
    const prompt = await screen.findByRole('heading', {
      name: '服务暂时不可用｜正在显示已缓存数据',
    })
    expect(prompt).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: '进入离线模式／查看只读数据' }),
    )
    expect(
      screen.queryByRole('heading', { name: prompt.textContent }),
    ).toBeNull()
    expect(
      screen.getByText('服务暂时不可用｜正在显示已缓存数据', {
        selector: 'div[role="status"] > span',
      }),
    ).toBeVisible()
    expect(screen.getByTestId('connection-readonly')).toHaveTextContent('true')

    const callsBeforeWrite = request.mock.calls.length
    await act(async () => fireEvent.click(screen.getByText('Write')))
    expect(await screen.findByText(/Calendar is read-only/)).toBeVisible()
    expect(request).toHaveBeenCalledTimes(callsBeforeWrite)

    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: '重试' })),
    )
    expect(checkConnection).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('heading', { name: prompt.textContent }),
    ).toBeNull()
    expect(
      screen.getByText('服务暂时不可用｜正在显示已缓存数据', {
        selector: 'div[role="status"] > span',
      }),
    ).toBeVisible()

    const reconnected = vi.fn()
    window.addEventListener('zentra-reconnected', reconnected)
    connected = true
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: '重试' })),
    )
    await waitFor(() =>
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'online',
      ),
    )
    expect(onReconnect).toHaveBeenCalledTimes(1)
    expect(reconnected).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByText('服务暂时不可用｜正在显示已缓存数据', {
        selector: 'div[role="status"] > span',
      }),
    ).toBeNull()

    await act(async () => fireEvent.click(screen.getByText('Load')))
    expect(
      await screen.findByRole('heading', { name: prompt.textContent }),
    ).toBeVisible()
    expect(screen.getByLabelText('Event title')).toBe(input)
    expect(input).toHaveValue('Keep cached draft')
    expect(mounted).toHaveBeenCalledTimes(1)
    window.removeEventListener('zentra-reconnected', reconnected)
    view.unmount()
  })

  it('recovers online immediately and preserves drafts over repeated device toggles', async () => {
    const setOffline = vi.fn(async () => {})
    const onReconnect = vi.fn(async () => {})
    const mounted = vi.fn()
    const { view } = desktopFixture(
      vi.fn(
        async () =>
          new Response('{}', {
            status: 200,
            headers: { 'x-zntr-cache': 'offline' },
          }),
      ),
      mounted,
      { setOffline, onReconnect },
    )
    await act(async () => fireEvent.click(screen.getByText('Load')))
    setNavigatorOnline(false)
    act(() => window.dispatchEvent(new Event('offline')))
    fireEvent.click(
      screen.getByRole('button', { name: '进入离线模式／查看只读数据' }),
    )
    const input = screen.getByLabelText('Event title')
    fireEvent.change(input, { target: { value: 'Draft survives toggles' } })
    const reconnected = vi.fn()
    window.addEventListener('zentra-reconnected', reconnected)

    setNavigatorOnline(true)
    act(() => window.dispatchEvent(new Event('online')))
    expect(screen.getByTestId('connection-status')).toHaveTextContent('online')
    expect(setOffline).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(onReconnect).toHaveBeenCalledTimes(1))
    expect(reconnected).toHaveBeenCalledTimes(1)

    setNavigatorOnline(false)
    act(() => window.dispatchEvent(new Event('offline')))
    expect(
      screen.getByRole('heading', { name: '离线模式｜设备未连接网络' }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: '进入离线模式／查看只读数据' }),
    )
    setNavigatorOnline(true)
    act(() => window.dispatchEvent(new Event('online')))
    await waitFor(() => expect(onReconnect).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('connection-status')).toHaveTextContent('online')
    expect(screen.getByLabelText('Event title')).toBe(input)
    expect(input).toHaveValue('Draft survives toggles')
    expect(mounted).toHaveBeenCalledTimes(1)
    expect(setOffline.mock.calls.map(([offline]) => offline)).toEqual([
      true,
      false,
      true,
      false,
    ])
    window.removeEventListener('zentra-reconnected', reconnected)
    view.unmount()
  })

  it('treats an uncached server error response as a service fault', async () => {
    const request = vi.fn(async () => new Response('{}', { status: 503 }))
    const { view } = desktopFixture(request, vi.fn())
    await act(async () => fireEvent.click(screen.getByText('Load')))
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'service-unavailable',
    )
    expect(
      await screen.findByRole('heading', { name: '服务暂时不可用' }),
    ).toBeVisible()
    expect(screen.getByTestId('connection-cache')).toHaveTextContent('false')
    expect(screen.queryByText('离线模式｜设备未连接网络')).toBeNull()
    view.unmount()
  })

  it('uses cached response markers without inventing device offline state', async () => {
    const request = vi.fn(
      async () =>
        new Response('{}', {
          status: 200,
          headers: { 'x-zntr-cache': 'offline' },
        }),
    )
    const { view } = desktopFixture(request, vi.fn())
    await act(async () => fireEvent.click(screen.getByText('Load')))
    expect(screen.getByTestId('connection-cache')).toHaveTextContent('true')
    expect(screen.getByTestId('connection-status')).toHaveTextContent('online')

    setNavigatorOnline(false)
    await act(async () => fireEvent.click(screen.getByText('Load')))
    expect(
      await screen.findByRole('heading', { name: '离线模式｜设备未连接网络' }),
    ).toBeVisible()
    view.unmount()
  })

  it('blocks DataProvider writes before optimistic state or transport while read-only', async () => {
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input), 'https://calendar.example').pathname
        const body = path.includes('categories')
          ? { categories: [] }
          : path.includes('countdowns')
            ? { countdowns: [] }
            : path.includes('bookmarks')
              ? { bookmarks: [] }
              : path.includes('settings')
                ? { settings: { language: 'en' } }
                : { events: [] }
        if (init?.method && init.method !== 'GET') {
          throw new Error('A write escaped the read-only boundary')
        }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'x-zntr-cache': 'fallback' },
        })
      },
    )
    const host: CalendarHost = {
      platform: 'desktop',
      request,
      session: {
        data: { user: { id: 'user', name: 'Alex', email: 'alex@example.com' } },
        isPending: false,
      },
      navigation: { push: vi.fn(), replace: vi.fn(), openExternal: vi.fn() },
    }
    function CategoryWriter() {
      const { createCategory } = useData()
      const [error, setError] = useState('')
      return (
        <button
          onClick={() =>
            void createCategory({ name: 'Work', color: 'blue' }).catch(
              (reason: Error) => setError(reason.message),
            )
          }
        >
          {error || 'Add category'}
        </button>
      )
    }
    function CachedDataProvider() {
      const { request: send } = useCalendarHost()
      return (
        <DataProvider api={createCalendarApi(send)}>
          <CategoryWriter />
        </DataProvider>
      )
    }
    const view = render(
      <SWRConfig value={{ provider: () => new Map(), errorRetryCount: 0 }}>
        <CalendarHostProvider value={host}>
          <ConnectionBoundary checkConnection={async () => false}>
            <CachedDataProvider />
          </ConnectionBoundary>
        </CalendarHostProvider>
      </SWRConfig>,
    )
    fireEvent.click(
      await screen.findByRole('button', {
        name: '进入离线模式／查看只读数据',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
    expect(
      await screen.findByText(
        'Offline mode is read-only. Reconnect before saving changes.',
      ),
    ).toBeVisible()
    expect(
      request.mock.calls.every(
        ([, init]) => !init?.method || init.method === 'GET',
      ),
    ).toBe(true)
    view.unmount()
  })

  it('may enter service mode when an online-event session refresh fails', async () => {
    const { view } = desktopFixture(
      vi.fn(
        async () =>
          new Response('{}', {
            status: 200,
            headers: { 'x-zntr-cache': 'offline' },
          }),
      ),
      vi.fn(),
      {
        onReconnect: async () => {
          throw new Error('Session refresh failed')
        },
      },
    )
    await act(async () => fireEvent.click(screen.getByText('Load')))
    setNavigatorOnline(false)
    act(() => window.dispatchEvent(new Event('offline')))
    fireEvent.click(
      screen.getByRole('button', { name: '进入离线模式／查看只读数据' }),
    )
    setNavigatorOnline(true)
    act(() => window.dispatchEvent(new Event('online')))
    expect(screen.getByTestId('connection-status')).toHaveTextContent('online')
    expect(
      await screen.findByRole('heading', {
        name: '服务暂时不可用｜正在显示已缓存数据',
      }),
    ).toBeVisible()
    expect(screen.queryByText('离线模式｜设备未连接网络')).toBeNull()
    view.unmount()
  })
})
