'use client'

import * as React from 'react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@zntr/ui/accordion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@zntr/ui/dialog'
import { ScrollArea } from '@zntr/ui/scroll-area'
import { translations, type Language } from '@zntr/i18n/calendar'
import { cn } from '@zntr/utils'

interface Notice {
  name: string
  version: string
  license: string
  copyright: string
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

  const groups = React.useMemo(() => {
    if (!notices) return []
    const map = new Map<string, Notice[]>()
    for (const n of notices) {
      const key = n.license || 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(n)
    }
    return [...map.entries()]
      .map(([license, items]) => ({
        license,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => b.items.length - a.items.length || a.license.localeCompare(b.license))
  }, [notices])

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.aboutBrandThirdParty}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[65vh] pr-3">
            {error && (
              <p className="text-sm text-muted-foreground">
                Failed to load third-party notices.
              </p>
            )}
            {!notices && !error && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {groups.length > 0 && (
              <Accordion type="multiple" className="w-full">
                {groups.map((g) => (
                  <AccordionItem key={g.license} value={g.license}>
                    <AccordionTrigger>
                      <span className="flex w-full items-center justify-between pr-2">
                        <span>{g.license}</span>
                        <span className="text-xs text-muted-foreground">
                          {g.items.length}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">
                        {g.items.map((n) => (
                          <li
                            key={`${n.name}@${n.version}`}
                            className="border-b border-border/40 pb-2 text-xs"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-foreground">
                                {n.name}{' '}
                                <span className="text-muted-foreground">
                                  {n.version}
                                </span>
                              </span>
                              <span className="text-muted-foreground">
                                {n.license}
                              </span>
                            </div>
                            <div className="mt-0.5 text-muted-foreground">
                              {n.copyright || '—'}
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
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
