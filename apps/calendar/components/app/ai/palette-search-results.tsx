'use client'

import { CommandGroup, CommandItem, CommandList } from '@zntr/ui/command'
import { Skeleton } from '@zntr/ui/skeleton'
import { ChevronDown, LoaderCircle, RotateCcw } from 'lucide-react'
import { getEventAccentColor } from '@/lib/event-colors'
import type { translations } from '@zntr/i18n/calendar'
import type { PaletteSearchHit } from './ai-command-palette'

type Translation = (typeof translations)[keyof typeof translations]

/** Keyword and semantic search share every result/empty/loading row. */
export function PaletteSearchResults({
  t,
  hits,
  total,
  status,
  hint,
  scope = [],
  error,
  onRetry,
  onSelect,
  formatWhen,
  onMore,
  loadingMore = false,
}: {
  t: Translation
  hits: PaletteSearchHit[]
  total: number
  status: 'idle' | 'loading' | 'ready' | 'error'
  hint: string
  scope?: string[]
  error?: string
  onRetry?: () => void
  onSelect: (hit: PaletteSearchHit) => void
  formatWhen: (hit: PaletteSearchHit) => string
  onMore?: () => void
  loadingMore?: boolean
}) {
  return (
    <CommandList className="min-h-48 max-h-[min(24rem,calc(100dvh-13rem))]">
      <div className="px-3 py-2 text-xs text-muted-foreground">
        {scope.length > 0 ? (
          <details className="group" onKeyDown={(e) => e.stopPropagation()}>
            <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
              {t.aiSearchScope}
              <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
            </summary>
            <p className="pt-2 leading-relaxed">{scope.join(' · ')}</p>
          </details>
        ) : (
          hint
        )}
      </div>
      {status === 'idle' && (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">
          {t.commandPaletteSearchPlaceholder}
        </p>
      )}
      {status === 'loading' && (
        <div className="space-y-1 px-3 py-2" role="status">
          <span className="sr-only">{t.aiSearchLoading}</span>
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center gap-3 py-2.5"
              aria-hidden
            >
              <Skeleton className="h-7 w-1 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}
      {status === 'ready' && hits.length === 0 && (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">
          {t.noMatchingEvents}
        </p>
      )}
      {status === 'ready' && hits.length > 0 && (
        <CommandGroup heading={`${total} ${t.events}`}>
          {hits.map((hit) => (
            <CommandItem
              key={hit.id}
              value={`event:${hit.id}`}
              className="gap-3 py-2.5"
              onSelect={() => onSelect(hit)}
            >
              <span
                className="h-7 w-1 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    hit.color && /^#[0-9a-f]{3,8}$/i.test(hit.color)
                      ? hit.color
                      : getEventAccentColor(hit.color ?? undefined),
                }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {hit.title || t.unnamedEvent}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatWhen(hit)}
                  {hit.location ? ` · ${hit.location}` : ''}
                </span>
              </span>
            </CommandItem>
          ))}
          {onMore && (
            <CommandItem
              value="load-more"
              onSelect={onMore}
              disabled={loadingMore}
            >
              {loadingMore && <LoaderCircle className="animate-spin" />}
              {t.aiSearchMore}
            </CommandItem>
          )}
        </CommandGroup>
      )}
      {status === 'error' && (
        <div className="p-2">
          <p
            role="alert"
            className="px-2 py-6 text-center text-sm text-destructive"
          >
            {error}
          </p>
          {onRetry && (
            <CommandItem value="search-retry" onSelect={onRetry}>
              <RotateCcw />
              {t.aiSearchRetry}
            </CommandItem>
          )}
        </div>
      )}
    </CommandList>
  )
}
