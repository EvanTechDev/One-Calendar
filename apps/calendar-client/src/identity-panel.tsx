import { useEffect, useRef, useState } from 'react'
import { Button } from '@zntr/ui/button'
import { LoaderCircle, Maximize } from 'lucide-react'
import { useCalendarDisconnected } from '@zntr/ui/calendar/components/connection-boundary'
import { invoke, listen } from './native'

/** Native child view: official same-origin forms + BotID, with no remote IPC. */
export function IdentityPanel({
  mode,
  section,
  onSignOut,
  sessionError,
}: {
  mode: 'sign-in' | 'settings'
  section?: string | null
  onSignOut?: () => void
  sessionError?: string | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const owner = useRef<string | null>(null)
  const disconnected = useCalendarDisconnected()
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const ready = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const hidden = useRef(disconnected)
  hidden.current = disconnected || error !== null || Boolean(sessionError)
  useEffect(() => {
    const element = container.current
    if (!element) return
    const id = crypto.randomUUID()
    owner.current = id
    let active = true
    let dispose: (() => void) | undefined
    const timeout = window.setTimeout(() => {
      if (active && !ready.current)
        setError(
          'Could not load this page. Check your connection and try again.',
        )
    }, 45_000)
    const bounds = () => {
      const rect = element.getBoundingClientRect()
      return {
        x: Math.max(0, rect.x),
        y: Math.max(0, rect.y),
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    }
    const resize = () => {
      void invoke('desktop_identity_bounds', {
        owner: id,
        bounds: bounds(),
        visible: !hidden.current,
      }).catch(() => {})
    }
    setLoaded(false)
    ready.current = false
    setError(null)
    void (async () => {
      dispose = await listen<string>(
        'desktop-identity-loaded',
        ({ payload }) => {
          if (active && payload === id) {
            ready.current = true
            setLoaded(true)
            setError(null)
            window.clearTimeout(timeout)
          }
        },
      )
      if (!active) {
        dispose()
        return
      }
      await invoke('desktop_identity_open', {
        owner: id,
        mode,
        section,
        bounds: bounds(),
      })
      resize()
    })().catch((reason: unknown) => {
      if (active) setError(String(reason))
    })
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', resize, true)
    // An offline load may have left the remote document on its error page.
    // Only restart an unfinished sign-in/settings load, never a loaded form.
    const reconnect = () => {
      if (active && !ready.current) setAttempt((n) => n + 1)
    }
    window.addEventListener('zentra-reconnected', reconnect)
    return () => {
      active = false
      window.clearTimeout(timeout)
      dispose?.()
      observer.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', resize, true)
      window.removeEventListener('zentra-reconnected', reconnect)
      void invoke('desktop_identity_close', { owner: id }).catch(() => {})
    }
  }, [mode, section, attempt])
  useEffect(() => {
    const rect = container.current?.getBoundingClientRect()
    if (!rect || !owner.current) return
    void invoke('desktop_identity_bounds', {
      owner: owner.current,
      bounds: {
        x: Math.max(0, rect.x),
        y: Math.max(0, rect.y),
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
      visible: !disconnected && !error && !sessionError,
    }).catch(() => {})
  }, [disconnected, error, sessionError])
  return (
    <section
      className={
        mode === 'sign-in' ? 'desktop-auth' : 'desktop-account-embedded'
      }
    >
      <header className="flex items-center justify-between gap-4 border-b px-5 py-3 text-sm">
        <span className="font-medium">
          {mode === 'sign-in' ? 'Zentra Calendar' : 'Account settings'}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle fullscreen"
            onClick={() =>
              void invoke('desktop_fullscreen', { enabled: null }).catch(
                () => {},
              )
            }
          >
            <Maximize className="size-4" />
          </Button>
          {onSignOut ? (
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sign out of this app
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Reload
            </Button>
          )}
        </div>
      </header>
      <div ref={container} className="relative min-h-0 flex-1">
        {!loaded && !error ? (
          <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            {mode === 'sign-in'
              ? 'Opening sign in…'
              : 'Opening account settings…'}
          </div>
        ) : null}
        {error || sessionError ? (
          <div
            role="alert"
            className="flex h-full flex-col items-center justify-center gap-4 p-6 text-sm"
          >
            <p>{error ?? sessionError}</p>
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
