'use client'

import { useEffect, useRef, useState } from 'react'
import { Power } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Switch } from '@zntr/ui/switch'
import { SettingRow } from '@zntr/ui/settings-row'
import type { CalendarHost } from '@zntr/calendar/host'
import type { translations } from '@zntr/i18n/calendar'

export function DesktopAutostart({
  autostart,
  t,
}: {
  autostart: NonNullable<CalendarHost['autostart']>
  t: (typeof translations)[keyof typeof translations]
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const pending = useRef(false)
  const requestId = useRef(0)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (pending.current) return
      const id = ++requestId.current
      setBusy(true)
      try {
        const value = await autostart.isEnabled()
        if (active && id === requestId.current) {
          setEnabled(value)
          setFailed(false)
        }
      } catch {
        if (active && id === requestId.current) {
          setEnabled(null)
          setFailed(true)
        }
      } finally {
        if (active && id === requestId.current) setBusy(false)
      }
    }
    void refresh()
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
    }
  }, [autostart, reload])

  const change = async (next: boolean) => {
    if (pending.current) return
    pending.current = true
    ++requestId.current
    setBusy(true)
    setFailed(false)
    try {
      const actual = await autostart.setEnabled(next)
      setEnabled(actual)
      setFailed(actual !== next)
    } catch {
      setFailed(true)
      // Registration can partially succeed; never keep an assumed OS state.
      setEnabled(null)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <SettingRow
        icon={<Power />}
        title={t.settingsAutostart}
        description={t.settingsAutostartDesc}
      >
        <Switch
          id="desktop-autostart"
          aria-label={t.settingsAutostart}
          aria-describedby={failed ? 'desktop-autostart-error' : undefined}
          checked={enabled === true}
          disabled={busy || enabled === null}
          onCheckedChange={(next) => void change(next)}
        />
      </SettingRow>
      {failed ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <p
            id="desktop-autostart-error"
            role="alert"
            className="flex-1 text-xs text-destructive"
          >
            {t.settingsAutostartError}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setReload((value) => value + 1)}
          >
            {t.aiSearchRetry}
          </Button>
        </div>
      ) : null}
    </>
  )
}
