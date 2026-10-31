import { Button } from '@zntr/ui/button'
import { CircleAlert, RefreshCw } from 'lucide-react'
import AuthWaitingLoading from '@zntr/ui/calendar/components/app/auth-waiting-loading'

export function DesktopBrand() {
  return (
    <div className="desktop-brand">
      <img src="/product-logo.svg" width={36} height={36} alt="" />
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
  if (!failed) return <AuthWaitingLoading />
  return (
    <main className="desktop-state">
      <section role="alert">
        <CircleAlert
          className="desktop-state-icon"
          size={28}
          aria-hidden="true"
        />
        <h1>Let’s reopen your calendar</h1>
        <p>
          The calendar could not finish loading. Reload Zentra to try again.
        </p>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw size={16} aria-hidden="true" />
          Reload calendar
        </Button>
      </section>
    </main>
  )
}
