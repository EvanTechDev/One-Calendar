'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { WifiOff, LoaderCircle, ArrowRight } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Button } from '@zntr/ui/button'
import {
  CalendarHostProvider,
  useCalendarHost,
} from '@zntr/shared/calendar/host'
import { useLanguage } from '@zntr/i18n/calendar'

export type CalendarConnectionStatus =
  | 'online'
  | 'device-offline'
  | 'service-unavailable'

export interface CalendarConnectionState {
  status: CalendarConnectionStatus
  readOnly: boolean
  cacheAvailable: boolean
}

const ConnectionContext = createContext(false)
const ConnectionStateContext = createContext<CalendarConnectionState>({
  status: 'online',
  readOnly: false,
  cacheAvailable: false,
})

export const useCalendarConnection = () => useContext(ConnectionStateContext)
export const useCalendarDisconnected = () => useContext(ConnectionContext)

export function NoInternet({
  retry,
  checking = false,
}: {
  retry: () => void
  checking?: boolean
}) {
  const [language] = useLanguage()
  const zh = language.startsWith('zh')
  return (
    <section
      className="bg-background text-foreground fixed inset-0 z-[1000] flex min-h-dvh flex-col px-8 py-8"
      role="alert"
      aria-live="polite"
    >
      <div className="m-auto w-full max-w-md py-16">
        <div className="bg-muted mb-7 flex size-14 items-center justify-center rounded-2xl">
          <WifiOff
            className="text-muted-foreground size-6"
            aria-hidden="true"
          />
        </div>
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest">
          {zh ? '连接已中断' : 'CONNECTION LOST'}
        </p>
        <h1
          id="calendar-connection-title"
          className="mb-4 text-3xl font-semibold tracking-tight"
        >
          {zh ? '暂时无法连接' : 'No internet connection'}
        </h1>
        <p
          id="calendar-connection-description"
          className="text-muted-foreground mb-8 text-sm leading-7"
        >
          {zh
            ? '请检查网络连接。当前日历会保留在这里，连接恢复后即可继续。'
            : 'Check your connection. Your calendar is staying right here, ready to continue when you reconnect.'}
        </p>
        <Button onClick={retry} disabled={checking}>
          {checking ? (
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
          ) : null}
          {checking
            ? zh
              ? '正在连接…'
              : 'Reconnecting…'
            : zh
              ? '重新连接'
              : 'Try again'}
          {!checking ? <ArrowRight className="size-4" /> : null}
        </Button>
      </div>
    </section>
  )
}

interface ConnectionBoundaryProps {
  children: ReactNode
  checkConnection?: () => Promise<boolean>
  onReconnect?: () => void | Promise<void>
}

/** Keep children mounted: no navigation, new SWR cache, or discarded editor state. */
export function ConnectionBoundary(props: ConnectionBoundaryProps) {
  const host = useCalendarHost()
  if (host.platform === 'desktop') return <DesktopConnectionBoundary {...props} />
  return <WebConnectionBoundary {...props} />
}

function WebConnectionBoundary({
  children,
  checkConnection,
  onReconnect,
}: ConnectionBoundaryProps) {
  const host = useCalendarHost()
  const [disconnected, setDisconnected] = useState(false)
  const [checking, setChecking] = useState(false)
  const [initialConnectionCheck, setInitialConnectionCheck] = useState(
    Boolean(checkConnection),
  )
  const inFlight = useRef(false)
  const disconnectedRef = useRef(disconnected)
  disconnectedRef.current = disconnected
  const retryRef = useRef<() => Promise<void>>(async () => {})
  const request = useMemo<typeof fetch>(
    () => async (input, init) => {
      try {
        return await host.request(input, init)
      } catch (error) {
        if (
          !(
            typeof error === 'object' &&
            error !== null &&
            'name' in error &&
            error.name === 'AbortError'
          )
        )
          // Native failures include account changes and local validation errors.
          // Only a separate reachability failure establishes a network outage.
          void retryRef.current()
        throw error
      }
    },
    [host.request],
  )
  const retry = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setChecking(true)
    try {
      const connected = checkConnection
        ? await checkConnection()
        : await host
            .request('/api/connection', { cache: 'no-store' })
            .then(() => true)
      if (connected) {
        setDisconnected(false)
        if (disconnectedRef.current) {
          // Session/API errors do not invalidate the successful network probe.
          try {
            await onReconnect?.()
          } catch {
            /* The host owns session errors. */
          }
          window.dispatchEvent(new Event('zentra-reconnected'))
        }
      } else setDisconnected(true)
    } catch {
      setDisconnected(true)
    } finally {
      inFlight.current = false
      setChecking(false)
    }
  }, [checkConnection, host.request, onReconnect])
  retryRef.current = retry
  useEffect(() => {
    const offline = () => setDisconnected(true)
    const online = () => {
      void retry()
    }
    if (!navigator.onLine) offline()
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => {
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', online)
    }
  }, [retry])
  useEffect(() => {
    // Native session restoration can fail without a fetch from the calendar.
    // A failed reachability probe covers this case without resetting identity.
    if (!checkConnection) return
    let active = true
    const probe = async () => {
      await retryRef.current()
      if (active) setInitialConnectionCheck(false)
    }
    void probe()
    const interval = window.setInterval(probe, 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [checkConnection])
  useEffect(() => {
    if (!disconnected) return
    const interval = window.setInterval(() => {
      void retryRef.current()
    }, 10_000)
    return () => window.clearInterval(interval)
  }, [disconnected])
  const connectedHost = useMemo(() => ({ ...host, request }), [host, request])
  useLayoutEffect(() => {
    if (!disconnected) return
    // Existing editor/settings portals stay mounted. Their outside-interaction
    // handlers must not interpret recovery controls as dismissing a draft.
    const preserveOpenForms = (event: Event) => event.preventDefault()
    const events = [
      'dismissableLayer.pointerDownOutside',
      'dismissableLayer.focusOutside',
    ]
    for (const name of events)
      document.addEventListener(name, preserveOpenForms, true)
    return () => {
      for (const name of events)
        document.removeEventListener(name, preserveOpenForms, true)
    }
  }, [disconnected])
  const connection = useMemo<CalendarConnectionState>(
    () => ({
      status: disconnected ? 'device-offline' : 'online',
      readOnly: false,
      cacheAvailable: false,
    }),
    [disconnected],
  )
  return (
    <ConnectionContext.Provider value={disconnected}>
      <ConnectionStateContext.Provider value={connection}>
        <CalendarHostProvider value={connectedHost}>
          <div
            inert={disconnected}
            style={disconnected ? { visibility: 'hidden' } : undefined}
          >
            {children}
          </div>
          {disconnected ? (
            <DialogPrimitive.Root open>
              <DialogPrimitive.Portal>
                <DialogPrimitive.Content
                  className="fixed inset-0 z-[1000] outline-none"
                  aria-labelledby="calendar-connection-title"
                  aria-describedby="calendar-connection-description"
                  onEscapeKeyDown={(event) => event.preventDefault()}
                  onInteractOutside={(event) => event.preventDefault()}
                >
                  <NoInternet
                    retry={() => void retry()}
                    checking={checking || initialConnectionCheck}
                  />
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          ) : null}
        </CalendarHostProvider>
      </ConnectionStateContext.Provider>
    </ConnectionContext.Provider>
  )
}

function DesktopConnectionBoundary({
  children,
  checkConnection,
  onReconnect,
}: ConnectionBoundaryProps) {
  const host = useCalendarHost()
  const [status, setStatus] = useState<CalendarConnectionStatus>(() => {
    if (!navigator.onLine) return 'device-offline'
    return host.session.source === 'cache' ? 'service-unavailable' : 'online'
  })
  const [cacheAvailable, setCacheAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const statusRef = useRef(status)
  statusRef.current = status
  const dismissedRef = useRef(dismissed)
  dismissedRef.current = dismissed
  const generationRef = useRef(0)
  const probeRef = useRef<Promise<void> | null>(null)
  const retryRef = useRef<() => Promise<void>>(async () => {})
  const enterFaultRef = useRef<(next: CalendarConnectionStatus) => void>(() => {})
  const recoverRef = useRef<(emitAfterRefreshFailure?: boolean) => Promise<void>>(
    async () => {},
  )
  const nativeOfflineRef = useRef<(offline: boolean) => void>(() => {})
  const onReconnectRef = useRef(onReconnect)
  onReconnectRef.current = onReconnect

  const enterFault = useCallback((next: CalendarConnectionStatus) => {
    if (statusRef.current === 'online') setDismissed(false)
    statusRef.current = next
    setStatus(next)
  }, [])
  enterFaultRef.current = enterFault

  const markOnline = useCallback(() => {
    statusRef.current = 'online'
    setStatus('online')
    setDismissed(false)
    setRetryAttempt(0)
    setChecking(false)
  }, [])

  const recover = useCallback(
    async (emitAfterRefreshFailure = false) => {
      const preserveDismissal = !emitAfterRefreshFailure && dismissedRef.current
      const generation = ++generationRef.current
      markOnline()
      try {
        await onReconnectRef.current?.()
      } catch {
        if (generation !== generationRef.current) return
        enterFaultRef.current('service-unavailable')
        if (preserveDismissal) setDismissed(true)
        if (emitAfterRefreshFailure)
          window.dispatchEvent(new Event('zentra-reconnected'))
        return
      }
      if (generation === generationRef.current)
        window.dispatchEvent(new Event('zentra-reconnected'))
    },
    [markOnline],
  )
  recoverRef.current = recover

  const setNativeOffline = useCallback(
    (offline: boolean) => {
      try {
        void Promise.resolve(host.setOffline?.(offline)).catch(() => {})
      } catch {
        // The browser state remains authoritative if native IPC is unavailable.
      }
    },
    [host.setOffline],
  )
  nativeOfflineRef.current = setNativeOffline

  const probe = useCallback(() => {
    if (probeRef.current) return probeRef.current
    if (statusRef.current === 'device-offline') return Promise.resolve()
    const generation = generationRef.current
    setChecking(true)
    const task = (async () => {
      try {
        const connected = checkConnection
          ? await checkConnection()
          : await host
              .request('/api/connection', { cache: 'no-store' })
              .then((response) => response.ok)
        if (generation !== generationRef.current) return
        if (connected) {
          await recoverRef.current()
        } else {
          enterFaultRef.current('service-unavailable')
          setRetryAttempt((attempt) => attempt + 1)
        }
      } catch {
        if (generation !== generationRef.current) return
        enterFaultRef.current('service-unavailable')
        setRetryAttempt((attempt) => attempt + 1)
      } finally {
        if (generation === generationRef.current) setChecking(false)
      }
    })()
    probeRef.current = task
    void task.then(() => {
      if (probeRef.current === task) probeRef.current = null
    })
    return task
  }, [checkConnection, host.request])
  retryRef.current = probe

  useEffect(() => {
    const offline = () => {
      generationRef.current += 1
      probeRef.current = null
      setChecking(false)
      nativeOfflineRef.current(true)
      enterFaultRef.current('device-offline')
    }
    const online = () => {
      generationRef.current += 1
      probeRef.current = null
      nativeOfflineRef.current(false)
      void recoverRef.current(true)
    }
    if (!navigator.onLine) offline()
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => {
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', online)
    }
  }, [])

  useEffect(() => {
    if (host.session.source !== 'cache') return
    if (statusRef.current === 'online') {
      enterFaultRef.current(
        navigator.onLine ? 'service-unavailable' : 'device-offline',
      )
    }
  }, [host.session.source])

  useEffect(() => {
    if (status !== 'service-unavailable') return
    const delay = Math.min(1000 * 2 ** retryAttempt, 5000)
    const timeout = window.setTimeout(() => {
      void retryRef.current()
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [status, retryAttempt])

  const request = useMemo<typeof fetch>(
    () => async (input, init) => {
      const method = (
        init?.method ??
        (input instanceof Request ? input.method : 'GET')
      ).toUpperCase()
      if (
        statusRef.current !== 'online' &&
        method !== 'GET' &&
        method !== 'HEAD'
      ) {
        throw new Error('Calendar is read-only while a cached state is active')
      }
      const generation = generationRef.current
      try {
        const response = await host.request(input, init)
        const cached = response.headers.get('x-zntr-cache')
        if (cached) {
          setCacheAvailable(true)
          if (generation === generationRef.current) {
            if (cached === 'fallback')
              enterFaultRef.current('service-unavailable')
            else if (cached === 'offline' && !navigator.onLine)
              enterFaultRef.current('device-offline')
          }
        } else if (
          (method === 'GET' || method === 'HEAD') &&
          (response.status === 429 || response.status >= 500) &&
          generation === generationRef.current
        ) {
          enterFaultRef.current('service-unavailable')
        }
        return response
      } catch (error) {
        const aborted =
          typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          error.name === 'AbortError'
        if (
          !aborted &&
          (method === 'GET' || method === 'HEAD') &&
          generation === generationRef.current
        ) {
          // Only a failed reachability probe can establish a service fault.
          void retryRef.current()
        }
        throw error
      }
    },
    [host.request],
  )

  const connectedHost = useMemo(() => ({ ...host, request }), [host, request])
  const blocking = status !== 'online' && (!cacheAvailable || !dismissed)
  const banner = status !== 'online' && cacheAvailable && dismissed
  const connection = useMemo<CalendarConnectionState>(
    () => ({
      status,
      readOnly: status !== 'online',
      cacheAvailable,
    }),
    [status, cacheAvailable],
  )
  const title =
    status === 'device-offline'
      ? '离线模式｜设备未连接网络'
      : cacheAvailable
        ? '服务暂时不可用｜正在显示已缓存数据'
        : '服务暂时不可用'

  useLayoutEffect(() => {
    if (!blocking) return
    const preserveOpenForms = (event: Event) => event.preventDefault()
    const events = [
      'dismissableLayer.pointerDownOutside',
      'dismissableLayer.focusOutside',
    ]
    for (const name of events)
      document.addEventListener(name, preserveOpenForms, true)
    return () => {
      for (const name of events)
        document.removeEventListener(name, preserveOpenForms, true)
    }
  }, [blocking])

  return (
    <ConnectionContext.Provider value={status !== 'online'}>
      <ConnectionStateContext.Provider value={connection}>
        <CalendarHostProvider value={connectedHost}>
          <div
            inert={blocking}
            style={blocking ? { visibility: 'hidden' } : undefined}
          >
            {children}
          </div>
          {blocking ? (
            <DialogPrimitive.Root open>
              <DialogPrimitive.Portal>
                <DialogPrimitive.Content
                  className="fixed inset-0 z-[1000] outline-none"
                  aria-labelledby="calendar-connection-title"
                  aria-describedby="calendar-connection-description"
                  onEscapeKeyDown={(event) => event.preventDefault()}
                  onInteractOutside={(event) => event.preventDefault()}
                >
                  <section
                    className="bg-background text-foreground fixed inset-0 flex min-h-dvh flex-col px-8 py-8"
                    role="alert"
                    aria-live="polite"
                  >
                    <div className="m-auto w-full max-w-md py-16">
                      <div className="bg-muted mb-7 flex size-14 items-center justify-center rounded-2xl">
                        <WifiOff
                          className="text-muted-foreground size-6"
                          aria-hidden="true"
                        />
                      </div>
                      <h1
                        id="calendar-connection-title"
                        className="mb-4 text-3xl font-semibold tracking-tight"
                      >
                        {title}
                      </h1>
                      <p
                        id="calendar-connection-description"
                        className="text-muted-foreground mb-8 text-sm leading-7"
                      >
                        {cacheAvailable
                          ? '现有内容和未保存的草稿会保留，可继续查看已缓存的只读数据。'
                          : '正在等待连接恢复，当前没有可显示的缓存数据。'}
                      </p>
                      {cacheAvailable ? (
                        <Button onClick={() => setDismissed(true)}>
                          进入离线模式／查看只读数据
                          <ArrowRight className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => void retryRef.current()}
                          disabled={checking}
                        >
                          {checking ? (
                            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                          ) : null}
                          {checking ? '正在连接…' : '重新连接'}
                        </Button>
                      )}
                    </div>
                  </section>
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          ) : null}
          {banner ? (
            <div
              className="bg-background text-foreground fixed inset-x-0 top-0 z-[900] flex items-center justify-center gap-4 border-b px-4 py-2 text-sm"
              role="status"
            >
              <span>{title}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void retryRef.current()}
                disabled={checking || status === 'device-offline'}
              >
                {checking ? (
                  <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                ) : null}
                重试
              </Button>
            </div>
          ) : null}
        </CalendarHostProvider>
      </ConnectionStateContext.Provider>
    </ConnectionContext.Provider>
  )
}
