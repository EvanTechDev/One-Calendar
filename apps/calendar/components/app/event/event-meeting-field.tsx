'use client'

import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Video, X } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Label } from '@zntr/ui/label'
import { toast } from 'sonner'

interface EventMeetingFieldProps {
  /**
   * The event the meeting attaches to, or null while the event is still a
   * draft. A draft cannot own a meeting yet, so the control switches to
   * "create it on save" mode.
   */
  eventId: string | null
  /** Reports the pending intent so the editor can act after the first save. */
  onPendingChange?: (pending: boolean) => void
}

interface MeetingInfo {
  id: string
  url: string
}

/**
 * Attaches a Zentra Meet room to a calendar event. The link is never stored
 * on the event row — it is resolved from the meeting's own record
 * (ADR-0019), so ending, reopening, or deleting a meeting never leaves a
 * stale URL behind on the event.
 */
export function EventMeetingField({
  eventId,
  onPendingChange,
}: EventMeetingFieldProps) {
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!eventId) {
      setMeeting(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(
          `/api/meetings?eventId=${encodeURIComponent(eventId)}`,
        )
        if (!response.ok) return
        const body = (await response.json()) as { meeting: MeetingInfo | null }
        if (!cancelled) setMeeting(body.meeting)
      } catch {
        // A missing meeting is indistinguishable from a failed lookup here;
        // the control simply offers to create one.
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [eventId])

  const setPendingIntent = (next: boolean) => {
    setPending(next)
    onPendingChange?.(next)
  }

  const attach = async () => {
    if (!eventId) {
      setPendingIntent(!pending)
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })
      if (!response.ok) throw new Error('Could not add the meeting')
      const body = (await response.json()) as { meeting: MeetingInfo }
      setMeeting(body.meeting)
    } catch {
      toast.error('Could not add the meeting')
    } finally {
      setLoading(false)
    }
  }

  const detach = async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const response = await fetch('/api/meetings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })
      if (!response.ok) throw new Error('Could not remove the meeting')
      setMeeting(null)
    } catch {
      toast.error('Could not remove the meeting')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!meeting) return
    await navigator.clipboard.writeText(meeting.url)
    toast.success('Meeting link copied')
  }

  return (
    <div className="space-y-2">
      <Label>Video meeting</Label>
      {meeting ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <Video className="size-4 shrink-0 text-muted-foreground" />
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
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={detach}
            disabled={loading}
            aria-label="Remove meeting"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={attach}
          disabled={loading}
          aria-pressed={pending}
        >
          <Video className="size-4" />
          {pending ? 'Meeting added on save' : 'Add Zentra Meet'}
        </Button>
      )}
    </div>
  )
}
