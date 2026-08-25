'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Copy, ExternalLink, Video } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { toast } from 'sonner'

export interface MeetingInfo {
  id: string
  url: string
}

/**
 * The event a Meeting is looked up by. A Series carries its Meeting on the
 * master row (ADR-0019), and an expanded occurrence's `id` is a synthetic
 * `<seriesId>_<stamp>` instance id that no row exists for — so every surface
 * must resolve through the series before asking the API.
 */
export function meetingLookupId(event: {
  id: string
  seriesId?: string | null
}): string {
  return event.seriesId ?? event.id
}

/**
 * Resolves the Meeting attached to an event, or null when there is none.
 *
 * `enabled` exists for the participant's copy of an event: `GET /api/meetings`
 * requires ownership, so a view-only event would always 404. That is not an
 * error worth reporting, it just means "nothing to show".
 */
export function useEventMeeting(
  eventId: string | null,
  enabled = true,
): [MeetingInfo | null, (next: MeetingInfo | null) => void] {
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null)

  useEffect(() => {
    if (!eventId || !enabled) {
      setMeeting(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(
          `/api/meetings?eventId=${encodeURIComponent(eventId)}`,
        )
        if (!response.ok) {
          // A 404 here is either "no such event for you" (a participant's
          // copy) or a lookup failure; both mean there is nothing to render,
          // and neither is worth a toast on a read-only surface.
          if (!cancelled) setMeeting(null)
          return
        }
        const body = (await response.json()) as { meeting: MeetingInfo | null }
        if (!cancelled) setMeeting(body.meeting)
      } catch {
        if (!cancelled) setMeeting(null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [eventId, enabled])

  return [meeting, setMeeting]
}

interface MeetingLinkControlsProps {
  meeting: MeetingInfo
  /** Surface-specific extras, e.g. the editor's "remove meeting" button. */
  actions?: ReactNode
  /**
   * True near the start time and while the meeting is running. Joining then is
   * the action the user came for, so it stops being a 28px ghost icon that
   * looks exactly as important as "copy".
   */
  urgent?: boolean
  /** Distinguishes "starting soon" from "happening now" in the label. */
  live?: boolean
}

/**
 * The read-only half of a Meeting on an event: the room code, copy, and open.
 * Shared so the editor and the event preview show the same thing — the
 * preview had no meeting display at all, which made an attached meeting
 * invisible everywhere except the editor that created it.
 */
export function MeetingLinkControls({
  meeting,
  actions,
  urgent = false,
  live = false,
}: MeetingLinkControlsProps) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(meeting.url)
      toast.success('Meeting link copied')
    } catch {
      toast.error('Could not copy the meeting link')
    }
  }

  if (urgent) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button type="button" size="sm" asChild>
          <a href={meeting.url} target="_blank" rel="noopener noreferrer">
            <Video className="size-3.5" />
            {live ? 'Join now' : 'Join meeting'}
          </a>
        </Button>
        {live ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
            </span>
            Happening now
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Starting soon</span>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto size-7 shrink-0"
          onClick={copy}
          aria-label="Copy meeting link"
        >
          <Copy className="size-3.5" />
        </Button>
        {actions}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-mono text-xs">
        {meeting.id}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={copy}
        aria-label="Copy meeting link"
      >
        <Copy className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        asChild
        aria-label="Join meeting"
      >
        <a href={meeting.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-3.5" />
        </a>
      </Button>
      {actions}
    </div>
  )
}
