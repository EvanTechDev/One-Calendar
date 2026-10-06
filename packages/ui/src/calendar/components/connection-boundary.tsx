'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { WifiOff, LoaderCircle, ArrowRight } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import {
  CalendarHostProvider,
  useCalendarHost,
} from '@zntr/utils/calendar-host'
import { useLanguage } from '@zntr/i18n/calendar'

const ConnectionContext = createContext(false)
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
      <header className="text-sm font-semibold tracking-tight">
        Zentra Calendar
      </header>
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
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          {zh ? '暂时无法连接' : 'No internet connection'}
        </h1>
        <p className="text-muted-foreground mb-8 text-sm leading-7">
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

/** Keep children mounted: no navigation, new SWR cache, or discarded editor state. */
export function ConnectionBoundary({
  children,
  checkConnection,
  onReconnect,
}: {
  children: ReactNode
  checkConnection?: () => Promise<boolean>
  onReconnect?: () => void | Promise<void>
}) {
  const host = useCalendarHost()
  const [disconnected, setDisconnected] = useState(false)
  const [checking, setChecking] = useState(false)
  const inFlight = useRef(false)
  const retryRef = useRef<() => Promise<void>>(async () => {})
  const request = useMemo<typeof fetch>(
    () => async (input, init) => {
      try {
        return await host.request(input, init)
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError'))
          setDisconnected(true)
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
        : (await host.request('/api/connection', { cache: 'no-store' })).ok
      if (connected) {
        setDisconnected(false)
        await onReconnect?.()
        window.dispatchEvent(new Event('zentra-reconnected'))
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
    const probe = () => {
      void checkConnection()
        .then((ok) => {
          if (active && !ok) setDisconnected(true)
        })
        .catch(() => {
          if (active) setDisconnected(true)
        })
    }
    probe()
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
  return (
    <ConnectionContext.Provider value={disconnected}>
      <CalendarHostProvider value={connectedHost}>
        <div
          inert={disconnected}
          style={disconnected ? { visibility: 'hidden' } : undefined}
        >
          {children}
        </div>
        {disconnected ? (
          <NoInternet retry={() => void retry()} checking={checking} />
        ) : null}
      </CalendarHostProvider>
    </ConnectionContext.Provider>
  )
}
