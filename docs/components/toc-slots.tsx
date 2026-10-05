'use client'

// Fumadocs UI 16.8.1's docs/page/slots/toc, with its original TOC list.
// Keep the template's desktop and mobile controls. See toc.LICENSE.
import {
  TOCScrollArea,
  useItems,
  useTOCItems,
} from 'fumadocs-ui/components/toc'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'fumadocs-ui/components/ui/collapsible'
import { useTreePath } from 'fumadocs-ui/contexts/tree'
import { useDocsLayout } from 'fumadocs-ui/layouts/docs'
import type {
  TOCProps,
  TOCPopoverProps,
} from 'fumadocs-ui/layouts/docs/page/slots/toc'
import { ChevronDown, Text } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { TOCEmpty, TOCItem, TOCItems } from './toc'

export { TOCProvider } from 'fumadocs-ui/components/toc'

export function TOC({ container, header, footer, list }: TOCProps) {
  const items = useTOCItems()
  return (
    <div
      id="nd-toc"
      {...container}
      className={cn(
        'sticky top-(--fd-docs-row-1) h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] flex flex-col [grid-area:toc] w-(--fd-toc-width) pt-12 pe-4 pb-2 xl:layout:[--fd-toc-width:268px] max-xl:hidden',
        container?.className,
      )}
    >
      {header}
      <h3
        id="toc-title"
        className="inline-flex items-center gap-1.5 text-sm text-fd-muted-foreground"
      >
        <Text className="size-4" /> On this page
      </h3>
      <TOCScrollArea>
        <TOCItems {...list}>
          {items.length === 0 && <TOCEmpty />}
          {items.map((item) => (
            <TOCItem key={item.url} item={item} />
          ))}
        </TOCItems>
      </TOCScrollArea>
      {footer}
    </div>
  )
}

export function TOCPopover({
  container,
  trigger,
  content,
  header,
  footer,
  list,
}: TOCPopoverProps) {
  const items = useTOCItems()
  const activeItems = useItems()
  const ref = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const { isNavTransparent } = useDocsLayout()
  const path = useTreePath().at(-1)
  const selectedIdx = activeItems.findIndex((item) => item.active)
  const showItem = selectedIdx !== -1 && !open
  const onClickOutside = useEffectEvent((event: MouseEvent) => {
    if (!open || !(event.target instanceof HTMLElement)) return
    if (ref.current && !ref.current.contains(event.target)) setOpen(false)
  })
  useEffect(() => {
    window.addEventListener('click', onClickOutside)
    return () => window.removeEventListener('click', onClickOutside)
  }, [])

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-toc-popover=""
      {...container}
      className={cn(
        'sticky top-(--fd-docs-row-2) z-10 [grid-area:toc-popover] h-(--fd-toc-popover-height) xl:hidden max-xl:layout:[--fd-toc-popover-height:--spacing(10)]',
        container?.className,
      )}
    >
      <header
        ref={ref}
        className={cn(
          'border-b backdrop-blur-sm transition-colors',
          (!isNavTransparent || open) && 'bg-fd-background/80',
          open && 'shadow-lg',
        )}
      >
        <CollapsibleTrigger
          {...trigger}
          data-toc-popover-trigger=""
          className={cn(
            'flex w-full h-10 items-center text-sm text-fd-muted-foreground gap-2.5 px-4 py-2.5 text-start focus-visible:outline-none [&_svg]:size-4 md:px-6',
            trigger?.className,
          )}
        >
          <ProgressCircle
            value={
              (activeItems.findLastIndex((item) => item.active) + 1) /
              Math.max(1, activeItems.length)
            }
            className={cn('shrink-0', open && 'text-fd-primary')}
          />
          <span className="grid flex-1 *:my-auto *:row-start-1 *:col-start-1">
            <span
              className={cn(
                'truncate transition-[opacity,translate,color]',
                open && 'text-fd-foreground',
                showItem && 'opacity-0 -translate-y-full pointer-events-none',
              )}
            >
              {path?.name ?? 'On this page'}
            </span>
            <span
              className={cn(
                'truncate transition-[opacity,translate]',
                !showItem && 'opacity-0 translate-y-full pointer-events-none',
              )}
            >
              {activeItems[selectedIdx]?.original.title}
            </span>
          </span>
          <ChevronDown
            className={cn(
              'shrink-0 transition-transform mx-0.5',
              open && 'rotate-180',
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent data-toc-popover-content="" {...content}>
          <div className="flex flex-col px-4 max-h-[50vh] md:px-6">
            {header}
            <TOCScrollArea>
              <TOCItems {...list}>
                {items.length === 0 && <TOCEmpty />}
                {items.map((item) => (
                  <TOCItem
                    key={item.url}
                    item={item}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </TOCItems>
            </TOCScrollArea>
            {footer}
          </div>
        </CollapsibleContent>
      </header>
    </Collapsible>
  )
}

function ProgressCircle({
  value,
  className,
}: {
  value: number
  className: string
}) {
  const progress = Math.min(1, Math.max(0, value))
  const circumference = 2 * Math.PI * 7.5
  return (
    <svg
      role="progressbar"
      viewBox="0 0 18 18"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={1}
      style={{ width: 18, height: 18 }}
      className={className}
    >
      <circle
        cx="9"
        cy="9"
        r="7.5"
        fill="none"
        strokeWidth="1.5"
        className="stroke-current/25"
      />
      <circle
        cx="9"
        cy="9"
        r="7.5"
        fill="none"
        strokeWidth="1.5"
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress * circumference}
        strokeLinecap="round"
        transform="rotate(-90 9 9)"
        className="transition-all"
      />
    </svg>
  )
}
