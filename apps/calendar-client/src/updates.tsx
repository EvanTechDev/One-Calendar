import { useEffect, useState } from 'react'
import { Button } from '@zntr/ui/button'
import { ArrowDownToLine, Check, LoaderCircle, RefreshCw } from 'lucide-react'
import { invoke, listen, type DesktopConfig } from './native'

export function DesktopUpdates({ config }: { config: DesktopConfig }) {
  const [update, setUpdate] = useState<{
    version: string
    notes?: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  useEffect(() => {
    let disposed = false
    const stops: Array<() => void> = []
    const retain = (stop: () => void) => (disposed ? stop() : stops.push(stop))
    void Promise.all([
      listen<{ downloaded: number; total?: number }>(
        'desktop-update-progress',
        ({ payload }) => {
          if (!disposed) {
            setProgress(
              payload.total
                ? Math.min(
                    100,
                    Math.round((payload.downloaded / payload.total) * 100),
                  )
                : null,
            )
            setStatus(
              payload.total
                ? `Downloading update… ${Math.round((payload.downloaded / payload.total) * 100)}%`
                : 'Downloading update…',
            )
          }
        },
      ).then(retain),
      listen('desktop-update-installing', () => {
        if (!disposed) setStatus('Installing update…')
      }).then(retain),
    ]).catch(() => {
      if (!disposed)
        setError(
          'Update progress is unavailable. Reopen settings to try again.',
        )
    })
    return () => {
      disposed = true
      stops.forEach((stop) => stop())
    }
  }, [])
  const check = async () => {
    setBusy(true)
    setError(null)
    setUpdate(null)
    setProgress(null)
    setStatus('Checking for updates…')
    try {
      const result = await invoke<{ version: string; notes?: string } | null>(
        'desktop_check_update',
      )
      setUpdate(result)
      setStatus(
        result
          ? `Version ${result.version} is available.`
          : 'You are up to date.',
      )
    } catch (reason) {
      setError(String(reason))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }
  const install = async () => {
    setBusy(true)
    setError(null)
    setStatus('Downloading update…')
    setProgress(0)
    try {
      await invoke('desktop_install_update')
    } catch (reason) {
      setError(String(reason))
      setUpdate(null)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="desktop-updates" aria-labelledby="desktop-update-title">
      <div className="desktop-update-heading">
        <div>
          <h3 id="desktop-update-title">Zentra Calendar</h3>
          <p>Version {config.version}</p>
        </div>
        <span className="desktop-channel">
          {config.environment === 'dev' ? 'Development' : 'Stable'}
        </span>
      </div>
      <p className="desktop-update-copy">
        Keep your desktop calendar up to date. Updates are installed when you
        choose.
      </p>
      {status ? (
        <p className="desktop-update-status" role="status">
          {busy ? (
            <LoaderCircle
              className="desktop-spinner"
              size={16}
              aria-hidden="true"
            />
          ) : !update ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <ArrowDownToLine size={16} aria-hidden="true" />
          )}
          {status}
        </p>
      ) : null}
      {error ? (
        <div className="desktop-update-error" role="alert">
          <strong>Could not complete the update</strong>
          <p>{error}</p>
        </div>
      ) : null}
      {busy && progress !== null ? (
        <progress
          className="desktop-update-progress"
          value={progress}
          max={100}
          aria-label="Update download"
        />
      ) : null}
      {update?.notes ? (
        <details className="desktop-update-notes">
          <summary>What’s new in {update.version}</summary>
          <p>{update.notes}</p>
        </details>
      ) : null}
      <Button
        variant={update ? 'default' : 'outline'}
        disabled={busy}
        onClick={() => void (update ? install() : check())}
      >
        {update ? (
          <ArrowDownToLine size={16} aria-hidden="true" />
        ) : (
          <RefreshCw size={16} aria-hidden="true" />
        )}
        {update
          ? 'Install and restart'
          : error
            ? 'Try again'
            : 'Check for updates'}
      </Button>
    </section>
  )
}
