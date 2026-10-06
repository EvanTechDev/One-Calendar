import { useEffect, useMemo, useState } from 'react'
import { CalendarHostProvider, type CalendarHost } from '@zntr/calendar-host'
import { ApiError } from '@zntr/calendar-host/request'
import { invoke, openExternal, type DesktopConfig } from './native'
import appIcon from '../src-tauri/icons/128x128.png'
import './App.css'

function App() {
  const [config, setConfig] = useState<DesktopConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [browserOpened, setBrowserOpened] = useState(false)

  useEffect(() => {
    let active = true
    setError(null)
    invoke<DesktopConfig>('desktop_config').then(
      (value) => {
        if (active) {
          setConfig(value)
          window.history.replaceState(null, '', '/app')
        }
      },
      (reason: unknown) => {
        if (active) setError(String(reason))
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  const host = useMemo<CalendarHost>(
    () => ({
      session: { data: null, isPending: config === null && error === null },
      request: async () => {
        throw new ApiError('Sign in to access calendar data.', 401, true)
      },
      navigation: {
        push: (to) => {
          if (config) void openExternal(new URL(to, config.apiOrigin).href)
        },
        replace: (to) => {
          if (config) void openExternal(new URL(to, config.apiOrigin).href)
        },
        openExternal: (to) => {
          void openExternal(to)
        },
      },
    }),
    [config, error],
  )

  const openSignIn = async () => {
    if (!config) return
    try {
      await openExternal(`${config.apiOrigin}/sign-in`)
      setBrowserOpened(true)
    } catch (reason) {
      setError(String(reason))
    }
  }

  return (
    <CalendarHostProvider value={host}>
      <main className="desktop-welcome">
        <section className="welcome-panel" aria-labelledby="app-name">
          <img src={appIcon} className="app-icon" alt="" width={64} height={64} />
          {config?.environment === 'dev' ? (
            <span className="environment">Dev</span>
          ) : null}
          <h1 id="app-name">{config?.appName ?? 'Zentra Calendar'}</h1>
          <p className="welcome-copy">Sign in to access your Zentra calendar.</p>
          {config ? (
            <>
              <button
                className="primary-action"
                onClick={() => void openSignIn()}
              >
                Sign in with your browser
              </button>
              <p className="connection">{new URL(config.apiOrigin).hostname}</p>
              {browserOpened ? (
                <p role="status">The sign-in page is open in your browser.</p>
              ) : null}
            </>
          ) : error === null ? (
            <p role="status">Starting calendar…</p>
          ) : (
            <button onClick={() => setAttempt((value) => value + 1)}>Retry</button>
          )}
          {error ? <p role="alert">{error}</p> : null}
          {config ? (
            <small className="version">Version {config.version}</small>
          ) : null}
        </section>
      </main>
    </CalendarHostProvider>
  )
}

export default App
