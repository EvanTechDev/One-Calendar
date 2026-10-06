import { Button } from '@zntr/ui/button'
import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react'
import appIcon from '../src-tauri/icons/128x128.png'

export function DesktopBrand() {
  return (
    <div className="desktop-brand">
      <img src={appIcon} width={36} height={36} alt="" />
      <span>
        Zentra <span className="desktop-brand-subtitle">Calendar</span>
      </span>
    </div>
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
