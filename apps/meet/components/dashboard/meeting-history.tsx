'use client'

import { useState } from 'react'
import { Clock, Copy, Search, Trash2, Users, Video } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Input } from '@zntr/ui/input'
import { Badge } from '@zntr/ui/badge'
import { toast } from 'sonner'
import { cn } from '@zntr/utils'

export interface MeetingRow {
  id: string
  createdAt: string
  endedAt: string | null
  eventTitle: string | null
  totalMinutes: number
  attendees: number
}

/**
 * The user's own meetings, with the duration and attendance the webhooks
 * recorded. Search runs server-side over room codes, event titles, attendee
 * names, and retained chat (ADR 0020).
 */
export function MeetingHistory({ rows }: { rows: MeetingRow[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MeetingRow[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [deleted, setDeleted] = useState<Set<string>>(new Set())

  const visible = (results ?? rows).filter((row) => !deleted.has(row.id))

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    const term = query.trim()
    if (!term) {
      setResults(null)
      return
    }
    setSearching(true)
    try {
      const response = await fetch(
        `/api/dashboard/search?q=${encodeURIComponent(term)}`,
      )
      if (!response.ok) throw new Error('Search failed')
      const body = (await response.json()) as { meetings: MeetingRow[] }
      setResults(body.meetings)
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const copyLink = async (id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/${id}`)
    toast.success('Meeting link copied')
  }

  const remove = async (id: string) => {
    try {
      const response = await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete failed')
      setDeleted((current) => new Set(current).add(id))
    } catch {
      toast.error('Could not delete that meeting')
    }
  }

  return (
    // Named by the Shell's section header, so the search form gets the full
    // row instead of sharing it with a duplicate heading.
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-1 gap-2" onSubmit={runSearch}>
          <div className="relative flex-1 sm:max-w-64">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                if (!event.target.value.trim()) setResults(null)
              }}
              placeholder="Search meetings"
              aria-label="Search meetings"
              className="h-9 w-full pl-9"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={searching}
          >
            {searching ? 'Searching…' : 'Search'}
          </Button>
        </form>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {results
            ? 'Nothing matched that search.'
            : 'Meetings you start will appear here.'}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {visible.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{row.id}</span>
                  {row.endedAt ? (
                    <Badge variant="secondary">Ended</Badge>
                  ) : null}
                  {row.eventTitle ? (
                    <span className="truncate text-sm text-muted-foreground">
                      {row.eventTitle}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatDate(row.createdAt)}</span>
                  {row.totalMinutes > 0 ? (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {row.totalMinutes} min
                    </span>
                  ) : null}
                  {row.attendees > 0 ? (
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {row.attendees}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn('size-8')}
                  onClick={() => copyLink(row.id)}
                  aria-label={`Copy link for ${row.id}`}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-8" asChild>
                  <a href={`/${row.id}`} aria-label={`Rejoin ${row.id}`}>
                    <Video className="size-3.5" />
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => remove(row.id)}
                  aria-label={`Delete ${row.id}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}
