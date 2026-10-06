import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  CalendarHostProvider,
  type CalendarHost,
} from '@zntr/utils/calendar-host'
import { CalendarDataHost } from '@zntr/ui/calendar/components/providers/calendar-data-host'
import { CalendarProvider } from '@zntr/ui/calendar/components/providers/calendar-context'
import { AVAILABLE_THEMES } from '@zntr/ui/calendar/lib/theme'
import { ThemeProvider } from 'next-themes'
import { SWRConfig } from 'swr'
import { Toaster, toast } from 'sonner'
import {
  createNativeFetch,
  invoke,
  listen,
  openExternal,
  type DesktopConfig,
  type SessionView,
} from './native'
import { DesktopUpdates } from './updates'
import { ConnectionBoundary } from '@zntr/ui/calendar/components/connection-boundary'
import { IdentityPanel } from './identity-panel'
import { DesktopNotice, DesktopState } from './desktop-surfaces'
import './styles.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/geist'
import '@fontsource-variable/instrument-sans'
import { CalendarBoundary } from './calendar-boundary'
import { receiveSession } from './session-state'
import './App.css'

const CalendarApp = lazy(() => import('@zntr/ui/calendar'))
const initialSession: SessionView = {
  generation: 0,
  user: null,
  expiresAt: null,
  pending: true,
  signingIn: false,
  error: null,
}

export default function App() {
  const [config, setConfig] = useState<DesktopConfig | null>(null)
  const [session, setSession] = useState(initialSession)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let dispose: (() => void) | undefined
    setStartupError(null)
    void (async () => {
      const value = await invoke<DesktopConfig>('desktop_config')
      if (!active) return
      setConfig(value)
      window.history.replaceState(null, '', '/app')
      dispose = await listen<SessionView>('desktop-session', ({ payload }) => {
        if (active) setSession((current) => receiveSession(current, payload))
      })
      if (!active) {
        dispose()
        return
      }
      const restored = await invoke<SessionView>('desktop_session')
      if (active) setSession((current) => receiveSession(current, restored))
    })().catch((error: unknown) => {
      if (active) setStartupError(String(error))
    })
    return () => {
      active = false
      dispose?.()
    }
  }, [attempt])

  const action = useCallback(async (command: string) => {
    try {
      await invoke(command)
    } catch (error) {
      toast.error(String(error))
    }
  }, [])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'F11' && event.key !== 'Escape') return
      if (event.key === 'F11') event.preventDefault()
      void invoke('desktop_fullscreen', {
        enabled: event.key === 'Escape' ? false : null,
      }).catch(() => {})
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    const subscription = listen<{ title: string }>(
      'desktop-reminder',
      ({ payload }) => {
        if (document.hasFocus()) toast(payload.title)
      },
    )
    return () => {
      void subscription.then((dispose) => dispose())
    }
  }, [])
  const navigate = useCallback(
    (destination: string) => {
      if (!config) return
      const url = new URL(destination, config.apiOrigin)
      if (url.origin === config.apiOrigin && url.pathname === '/app') {
        window.history.pushState(null, '', `/app${url.search}${url.hash}`)
        window.dispatchEvent(new PopStateEvent('popstate'))
        return
      }
      void (
        url.origin === config.apiOrigin
          ? invoke('desktop_open_page', { destination: url.href })
          : openExternal(url.href)
      ).catch((error: unknown) => toast.error(String(error)))
    },
    [config],
  )

  useEffect(() => {
    const followLink = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest('a[href]') : null
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute('download')
      )
        return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || /^(blob|data):/.test(href)) return
      event.preventDefault()
      event.stopPropagation()
      navigate(href)
    }
    document.addEventListener('click', followLink, true)
    document.addEventListener('auxclick', followLink, true)
    return () => {
      document.removeEventListener('click', followLink, true)
      document.removeEventListener('auxclick', followLink, true)
    }
  }, [navigate])

  useEffect(() => {
    if (!session.user) return
    const refresh = () => {
      void action('desktop_session')
    }
    const interval = window.setInterval(refresh, 5 * 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [session.user?.id, action])

  const request = useMemo<typeof fetch>(() => {
    const native = createNativeFetch(
      config?.apiOrigin ?? 'https://calendar.xyehr.cn',
    )
    return async (input, init) => {
      try {
        const response = await native(input, init)
        if (response.status >= 500)
          setConnectionError('Zentra is temporarily unavailable.')
        return response
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setConnectionError(
            'Cannot connect to Zentra. Check your connection and retry.',
          )
        }
        throw error
      }
    }
  }, [config?.apiOrigin])

  const host = useMemo<CalendarHost>(
    () => ({
      platform: 'desktop',
      origin: config?.apiOrigin,
      session: {
        data: session.user ? { user: session.user } : null,
        isPending: session.pending,
      },
      request,
      navigation: { push: navigate, replace: navigate, openExternal: navigate },
      saveFile: (name, content) =>
        invoke<boolean>('desktop_save_file', { name, content }),
      readExternal: (url) => invoke('desktop_read_external', { url }),
      requestNotifications: () =>
        invoke<boolean>('desktop_notification_permission'),
      renderAccount: (section) => (
        <IdentityPanel
          mode="settings"
          section={section}
          onSignOut={() => void action('desktop_sign_out')}
        />
      ),
      renderUpdate: () => (config ? <DesktopUpdates config={config} /> : null),
    }),
    [config, session, request, navigate, action],
  )

  const retry = useCallback(async () => {
    await action('desktop_session')
    setConnectionError(null)
  }, [action])
  const error = startupError ?? session.error

  return (
    <ThemeProvider
      attribute="class"
      themes={[...AVAILABLE_THEMES]}
      defaultTheme="system"
      enableSystem
    >
      <CalendarHostProvider value={host}>
        <ConnectionBoundary
          checkConnection={checkConnection}
          onReconnect={retry}
        >
          {config && session.user ? (
            <>
              {connectionError || error ? (
                <div className="desktop-connection">
                  <DesktopNotice
                    title="Connection needs attention"
                    message={connectionError ?? error ?? ''}
                    onRetry={() => void retry()}
                  />
                </div>
              ) : null}
              <CalendarBoundary key={session.user.id}>
                <SWRConfig
                  value={{ provider: () => new Map(), errorRetryCount: 1 }}
                >
                  <CalendarDataHost>
                    <CalendarProvider>
                      <Suspense fallback={<DesktopState />}>
                        <CalendarApp />
                      </Suspense>
                    </CalendarProvider>
                  </CalendarDataHost>
                </SWRConfig>
              </CalendarBoundary>
            </>
          ) : config && (!session.pending || session.signingIn) ? (
            <IdentityPanel mode="sign-in" sessionError={session.error} />
          ) : startupError ? (
            <DesktopNotice
              title="Could not open calendar"
              message={startupError}
              onRetry={() => setAttempt((n) => n + 1)}
            />
          ) : (
            <DesktopState />
          )}
        </ConnectionBoundary>
        <Toaster richColors />
      </CalendarHostProvider>
    </ThemeProvider>
  )
}

const checkConnection = () => invoke<boolean>('desktop_connection')
