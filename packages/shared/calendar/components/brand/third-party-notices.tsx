'use client'

import * as React from 'react'

import { Button } from '@zntr/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@zntr/ui/dialog'
import { ScrollArea } from '@zntr/ui/scroll-area'
import { translations, type Language } from '@zntr/i18n/calendar'
import { cn } from '@zntr/utils'

interface Notice {
  name: string
  version: string
  license: string
  repository: string
}

export function ThirdPartyNotices({
  language,
  trigger,
}: {
  language: Language
  trigger: React.ReactNode
}) {
  const t = translations[language]
  const [open, setOpen] = React.useState(false)
  const [notices, setNotices] = React.useState<Notice[] | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!open || notices || error) return
    let cancelled = false
    fetch('/third-party-notices.json')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((data: Notice[]) => {
        if (!cancelled) setNotices(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, notices, error])

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.aboutBrandThirdParty}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-3">
            {error && (
              <p className="text-sm text-muted-foreground">
                Failed to load third-party notices.
              </p>
            )}
            {!notices && !error && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {notices && (
              <ul className="space-y-2 text-xs">
                {notices.map((n) => (
                  <li
                    key={`${n.name}@${n.version}`}
                    className="border-b border-border/40 pb-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {n.name}
                      </span>
                      <span className="text-muted-foreground">{n.version}</span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground">
                      {n.license}
                      {n.repository && (
                        <>
                          {' · '}
                          <a
                            href={n.repository}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2 hover:text-foreground"
                          >
                            repository
                          </a>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
