import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { CalendarHostProvider, type CalendarHost } from '@zntr/calendar-host'
import { CalendarDataHost } from '@zntr/calendar-ui/components/providers/calendar-data-host'
import { CalendarProvider } from '@zntr/calendar-ui/components/providers/calendar-context'
import { AVAILABLE_THEMES } from '@zntr/calendar-ui/lib/theme'
import { ThemeProvider } from 'next-themes'
import { SWRConfig } from 'swr'
import { Toaster, toast } from 'sonner'
import { Button } from '@zntr/ui/button'
import {
  createNativeFetch,
  invoke,
  listen,
  openExternal,
  type DesktopConfig,
  type SessionView,
} from './native'
import { DesktopUpdates } from './updates'
import appIcon from '../src-tauri/icons/128x128.png'
import '@zntr/calendar-ui/styles.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/geist'
import '@fontsource-variable/instrument-sans'
import { CalendarBoundary } from './calendar-boundary'
import { receiveSession } from './session-state'
import './App.css'

const CalendarApp = lazy(() => import('@zntr/calendar-ui'))
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
  const [revision, setRevision] = useState(0)

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
        <section className="space-y-4">
          <h3 className="font-medium">
            {session.user?.name ?? session.user?.email}
          </h3>
          <p className="text-sm text-muted-foreground">{session.user?.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  `/account${section ? `?section=${encodeURIComponent(section)}` : ''}`,
                )
              }
            >
              Manage account in browser
            </Button>
            <Button
              variant="outline"
              onClick={() => void action('desktop_sign_out')}
            >
              Sign out of this app
            </Button>
          </div>
        </section>
      ),
      renderUpdate: () => (config ? <DesktopUpdates config={config} /> : null),
    }),
    [config, session, request, navigate, action],
  )

  const retry = async () => {
    await action('desktop_session')
    setConnectionError(null)
    setRevision((value) => value + 1)
  }
  const error = startupError ?? session.error

  return (
    <ThemeProvider
      attribute="class"
      themes={[...AVAILABLE_THEMES]}
      defaultTheme="system"
      enableSystem
    >
      <CalendarHostProvider value={host}>
        {config && session.user ? (
          <>
            {connectionError || error ? (
              <div className="desktop-connection" role="alert">
                <span>{connectionError ?? error}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void retry()}
                >
                  Retry
                </Button>
              </div>
            ) : null}
            <CalendarBoundary key={`${session.user.id}:${revision}`}>
              <SWRConfig
                value={{ provider: () => new Map(), errorRetryCount: 1 }}
              >
                <CalendarDataHost>
                  <CalendarProvider>
                    <Suspense
                      fallback={
                        <div className="desktop-welcome" role="status">
                          Loading calendar…
                        </div>
                      }
                    >
                      <CalendarApp />
                    </Suspense>
                  </CalendarProvider>
                </CalendarDataHost>
              </SWRConfig>
            </CalendarBoundary>
          </>
        ) : (
          <main className="desktop-welcome">
            <section className="welcome-panel" aria-labelledby="app-name">
              <img
                src={appIcon}
                className="app-icon"
                alt=""
                width={64}
                height={64}
              />
              {config?.environment === 'dev' ? (
                <span className="environment">Dev</span>
              ) : null}
              <h1 id="app-name">{config?.appName ?? 'Zentra Calendar'}</h1>
              <p className="welcome-copy">
                Sign in to access your Zentra calendar.
              </p>
              {config && !startupError ? (
                <>
                  <Button
                    className="w-full"
                    disabled={session.pending}
                    onClick={() => void action('desktop_sign_in')}
                  >
                    Sign in with your browser
                  </Button>
                  {session.pending ? (
                    <>
                      <p role="status">
                        {session.signingIn
                          ? 'Waiting for sign-in…'
                          : 'Restoring your session…'}
                      </p>
                      {session.signingIn ? (
                        <Button
                          variant="ghost"
                          onClick={() => void action('desktop_cancel_sign_in')}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  <p className="connection">
                    {new URL(config.apiOrigin).hostname}
                  </p>
                </>
              ) : !error ? (
                <p role="status">Starting calendar…</p>
              ) : null}
              {error ? (
                <>
                  <p role="alert">{error}</p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      startupError
                        ? setAttempt((value) => value + 1)
                        : void action('desktop_session')
                    }
                  >
                    Retry
                  </Button>
                </>
              ) : null}
              {config ? (
                <small className="version">Version {config.version}</small>
              ) : null}
            </section>
          </main>
        )}
        <Toaster richColors />
      </CalendarHostProvider>
    </ThemeProvider>
  )
}
