'use client'

import { useState } from 'react'
import { Video, X } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Label } from '@zntr/ui/label'
import { toast } from 'sonner'
import {
  MeetingLinkControls,
  useEventMeeting,
} from '@/components/app/event/event-meeting-link'

interface EventMeetingFieldProps {
  /**
   * The event the meeting attaches to, or null while the event is still a
   * draft. A draft cannot own a meeting yet, so the control switches to
   * "create it on save" mode.
   */
  eventId: string | null
  /**
   * Whether "Add Zentra Meet" is armed on a draft. Owned by the editor, not
   * here: this component unmounts with the popover, so a local copy and the
   * editor's copy could disagree — and the editor's copy is what decides
   * whether a meeting gets attached after the save.
   */
  pending: boolean
  onPendingChange: (pending: boolean) => void
}

/**
 * Attaches a Zentra Meet room to a calendar event. The link is never stored
 * on the event row — it is resolved from the meeting's own record
 * (ADR-0019), so ending, reopening, or deleting a meeting never leaves a
 * stale URL behind on the event.
 */
export function EventMeetingField({
  eventId,
  pending,
  onPendingChange,
}: EventMeetingFieldProps) {
  const [meeting, setMeeting] = useEventMeeting(eventId)
  const [loading, setLoading] = useState(false)

  const attach = async () => {
    if (!eventId) {
      onPendingChange(!pending)
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
      const body = (await response.json()) as {
        meeting: { id: string; url: string }
      }
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

  return (
    <div className="space-y-2">
      <Label>Video meeting</Label>
      {meeting ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <Video className="size-4 shrink-0 text-muted-foreground" />
          <MeetingLinkControls
            meeting={meeting}
            actions={
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
            }
          />
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
