import { useState } from 'react'
import type { CalendarUser } from '@zntr/calendar-host'
import { Button } from '@zntr/ui/button'
import {
  ArrowUpRight,
  CircleAlert,
  LoaderCircle,
  LogOut,
  RefreshCw,
} from 'lucide-react'
import type { DesktopConfig, SessionView } from './native'
import appIcon from '../src-tauri/icons/128x128.png'

export function DesktopBrand({ dev = false }: { dev?: boolean }) {
  return (
    <div className="desktop-brand">
      <img src={appIcon} width={36} height={36} alt="" />
      <span>
        Zentra <span className="desktop-brand-subtitle">Calendar</span>
      </span>
      {dev ? <span className="desktop-channel">Dev</span> : null}
    </div>
  )
}

function CalendarIllustration() {
  const [today] = useState(() => new Date())
  const first = new Date(today.getFullYear(), today.getMonth(), 1).getDay()
  const offset = (first + 6) % 7
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return (
    <aside className="welcome-art" aria-hidden="true">
      <div className="welcome-calendar">
        <div className="welcome-calendar-heading">
          <span>{today.toLocaleDateString(undefined, { month: 'long' })}</span>
          <span>{today.getFullYear()}</span>
        </div>
        <div className="welcome-date">
          <span>{String(today.getDate()).padStart(2, '0')}</span>
          <div>
            {today.toLocaleDateString(undefined, { weekday: 'long' })}
            <small>Make room for your day.</small>
          </div>
        </div>
        <div className="welcome-month">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <span className="welcome-weekday" key={`weekday-${index}`}>
              {day}
            </span>
          ))}
          {Array.from(
            { length: Math.ceil((offset + days) / 7) * 7 },
            (_, index) => {
              const day = index - offset + 1
              return (
                <span
                  key={index}
                  className={
                    day === today.getDate() ? 'welcome-today' : undefined
                  }
                >
                  {day > 0 && day <= days ? day : ''}
                </span>
              )
            },
          )}
        </div>
      </div>
      <p>A little space. A clearer view.</p>
    </aside>
  )
}

export function DesktopWelcome({
  config,
  session,
  error,
  startupFailed,
  onSignIn,
  onCancel,
  onRetry,
}: {
  config: DesktopConfig | null
  session: SessionView
  error: string | null
  startupFailed: boolean
  onSignIn: () => void
  onCancel: () => void
  onRetry: () => void
}) {
  const waiting = session.signingIn
  const restoring = !config || (session.pending && !waiting)
  return (
    <main className="desktop-entry">
      <section className="welcome-content" aria-labelledby="welcome-title">
        <DesktopBrand dev={config?.environment === 'dev'} />
        <div className="welcome-intro">
          <p className="desktop-eyebrow">YOUR CALENDAR, CLOSE AT HAND</p>
          <h1 id="welcome-title">
            Your day,
            <br />
            in view.
          </h1>
          <p className="desktop-description">
            Plans, people, and a little more room to focus. Sign in to pick up
            where you left off.
          </p>
          <div className="welcome-actions">
            {error ? (
              <DesktopNotice
                title={
                  startupFailed
                    ? 'Could not start Zentra'
                    : 'Could not finish connecting'
                }
                message={error}
                onRetry={onRetry}
              />
            ) : null}
            {waiting ? (
              <div className="welcome-wait" role="status">
                <LoaderCircle
                  className="desktop-spinner"
                  size={20}
                  aria-hidden="true"
                />
                <div>
                  <strong>Finish signing in in your browser</strong>
                  <p>We’ll bring you back here when you’re ready.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            ) : restoring && !error ? (
              <div className="welcome-restoring" role="status">
                <LoaderCircle
                  className="desktop-spinner"
                  size={18}
                  aria-hidden="true"
                />
                {config ? 'Restoring your session…' : 'Starting calendar…'}
              </div>
            ) : null}
            {config && !startupFailed && !waiting && !restoring ? (
              <>
                <Button className="welcome-signin" size="lg" onClick={onSignIn}>
                  Sign in with your browser{' '}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Button>
                <p className="welcome-hint">
                  Use your existing Zentra account.
                </p>
              </>
            ) : null}
          </div>
        </div>
        <footer className="welcome-footer">
          <span>
            {config ? new URL(config.apiOrigin).hostname : 'Zentra Calendar'}
          </span>
          {config ? <span>Version {config.version}</span> : null}
        </footer>
      </section>
      <CalendarIllustration />
    </main>
  )
}

export function DesktopNotice({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry: () => void
}) {
  return (
    <div className="desktop-notice" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" />
        Retry
      </Button>
    </div>
  )
}

export function DesktopState({ failed = false }: { failed?: boolean }) {
  return (
    <main className="desktop-state">
      <DesktopBrand />
      <section role={failed ? 'alert' : 'status'}>
        {failed ? (
          <CircleAlert
            className="desktop-state-icon"
            size={28}
            aria-hidden="true"
          />
        ) : (
          <LoaderCircle
            className="desktop-spinner desktop-state-icon"
            size={28}
            aria-hidden="true"
          />
        )}
        <h1>
          {failed
            ? 'Let’s reopen your calendar'
            : 'Getting your calendar ready'}
        </h1>
        <p>
          {failed
            ? 'The calendar could not finish loading. Reload Zentra to try again.'
            : 'Bringing your plans into view…'}
        </p>
        {failed ? (
          <Button onClick={() => window.location.reload()}>
            <RefreshCw size={16} aria-hidden="true" />
            Reload calendar
          </Button>
        ) : null}
      </section>
    </main>
  )
}

export function DesktopAccount({
  user,
  onManage,
  onSignOut,
}: {
  user: CalendarUser | null
  onManage: () => void
  onSignOut: () => void
}) {
  return (
    <section className="desktop-account">
      <div className="desktop-identity">
        <span className="desktop-avatar" aria-hidden="true">
          {(user?.name ?? user?.email ?? 'Z').slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h3>{user?.name || 'Your account'}</h3>
          <p>{user?.email}</p>
        </div>
      </div>
      <div className="desktop-account-row">
        <div>
          <h4>Account & security</h4>
          <p>Manage your profile, password, and sign-in methods.</p>
        </div>
        <Button variant="outline" onClick={onManage}>
          Open in browser
          <ArrowUpRight size={15} aria-hidden="true" />
        </Button>
      </div>
      <div className="desktop-account-row">
        <div>
          <h4>This desktop app</h4>
          <p>Signing out here keeps your browser signed in.</p>
        </div>
        <Button variant="ghost" onClick={onSignOut}>
          <LogOut size={15} aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </section>
  )
}
