'use client'

import { ArrowUpRight, Copy, History, Video } from 'lucide-react'
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
      <div className="flex min-h-44 flex-col items-center justify-center rounded-xl bg-muted/40 px-5 py-6 text-center">
        <span className="mb-3 flex size-11 items-center justify-center rounded-2xl border bg-background text-meet-accent">
          <History className="size-5" />
        </span>
        <p className="text-sm font-medium">Pick up where you left off</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Meetings you start will appear here.
        </p>
      </div>
    )
  }

  const copyLink = async (id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/${id}`)
    toast.success('Meeting link copied')
  }

  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
        >
          <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-meet-tint text-meet-accent min-[400px]:flex">
            <Video className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">
                {row.eventTitle || row.id}
              </span>
              {row.endedAt ? <Badge variant="secondary">Ended</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(row.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-10 rounded-xl"
              onClick={() => copyLink(row.id)}
              aria-label={`Copy link for ${row.id}`}
            >
              <Copy className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="size-10 rounded-xl"
              asChild
            >
              <a href={`/${row.id}`} aria-label={`Rejoin ${row.id}`}>
                <ArrowUpRight className="size-4" />
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
