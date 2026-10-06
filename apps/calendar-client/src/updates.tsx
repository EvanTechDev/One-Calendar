import { useEffect, useState } from 'react'
import { Button } from '@zntr/ui/button'
import { invoke, listen, type DesktopConfig } from './native'

export function DesktopUpdates({ config }: { config: DesktopConfig }) {
  const [update, setUpdate] = useState<{
    version: string
    notes?: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let disposed = false
    const listeners = Promise.all([
      listen<{ downloaded: number; total?: number }>(
        'desktop-update-progress',
        ({ payload }) => {
          if (!disposed)
            setStatus(
              payload.total
                ? `Downloading update… ${Math.round((payload.downloaded / payload.total) * 100)}%`
                : 'Downloading update…',
            )
        },
      ),
      listen('desktop-update-installing', () => {
        if (!disposed) setStatus('Installing update…')
      }),
    ])
    return () => {
      disposed = true
      void listeners.then((stops) => stops.forEach((stop) => stop()))
    }
  }, [])
  const check = async () => {
    setBusy(true)
    setError(null)
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
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-medium">{config.appName}</h3>
      <p className="text-sm text-muted-foreground">
        Version {config.version} ·{' '}
        {config.environment === 'dev' ? 'Development' : 'Stable'} channel
      </p>
      {status ? (
        <p className="text-sm" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {update?.notes ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {update.notes}
        </p>
      ) : null}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void (update ? install() : check())}
      >
        {update ? 'Install and restart' : 'Check for updates'}
      </Button>
    </section>
  )
}
