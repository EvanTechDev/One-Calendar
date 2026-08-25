'use client'

import type { ReactNode } from 'react'
import { Copy, ExternalLink, Video } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { toast } from 'sonner'
import type { MeetingInfo } from '@/hooks/use-event-meeting-draft'

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
