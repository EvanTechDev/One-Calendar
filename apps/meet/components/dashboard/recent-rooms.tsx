'use client'

import { Copy, Video } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Badge } from '@zntr/ui/badge'
import { toast } from 'sonner'
import type { MeetingRow } from '@/components/dashboard/meeting-history'

/**
 * Home's compact rejoin list — the same rows Your-meetings shows, minus search,
 * stats, and delete. Rejoining a room you were just in is the second most
 * common act after starting one, and it should not require changing section.
 *
 * Delete is deliberately absent: a destructive action beside a greeting is a
 * mis-click, and it already lives in Your meetings where the row also shows the
 * duration and attendance that make it a considered decision.
 */
export function RecentRooms({ rows }: { rows: MeetingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Meetings you start will appear here.
      </p>
    )
  }

  const copyLink = async (id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/${id}`)
    toast.success('Meeting link copied')
  }

  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{row.id}</span>
              {row.endedAt ? <Badge variant="secondary">Ended</Badge> : null}
              {row.eventTitle ? (
                <span className="truncate text-sm text-muted-foreground">
                  {row.eventTitle}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(row.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
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
          </div>
        </li>
      ))}
    </ul>
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
