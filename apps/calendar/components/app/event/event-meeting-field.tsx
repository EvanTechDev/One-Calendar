'use client'

import { Video, X } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { Label } from '@zntr/ui/label'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { MeetingLinkControls } from '@/components/app/event/event-meeting-link'
import type { EventMeetingDraft } from '@/hooks/use-event-meeting-draft'

interface EventMeetingFieldProps {
  /**
   * The whole lifecycle, owned by the editor rather than here: this component
   * unmounts with the popover, so cleanup state kept locally would be destroyed
   * by the very close it needs to react to.
   */
  draft: EventMeetingDraft
}

/**
 * Attaches a Zentra Meet room to a calendar event. The link is never stored
 * on the event row — it is resolved from the meeting's own record
 * (ADR-0019), so ending, reopening, or deleting a meeting never leaves a
 * stale URL behind on the event.
 *
 * The room is created on click, not on save, so the organiser can copy the link
 * straight away (Google Calendar's behaviour). A room created for an event that
 * is never saved is deleted when the editor closes.
 */
export function EventMeetingField({ draft }: EventMeetingFieldProps) {
  const { meeting, busy, add, remove } = draft
  const [language] = useLanguage()
  const t = translations[language]

  const confirmRemove = () => {
    // Removing the meeting deletes the room, and holding its link is what
    // admits someone (ADR-0019) — so every participant who already has the
    // link loses access, and re-adding mints a different code. Too destructive
    // to fire from a bare icon click.
    const confirmed = window.confirm(t.removeMeetingConfirm)
    if (confirmed) void remove()
  }

  return (
    <div className="space-y-2">
      <Label>{t.videoMeeting}</Label>
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
                className="size-7 shrink-0"
                onClick={confirmRemove}
                disabled={busy}
                aria-label={t.removeMeeting}
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
          onClick={() => void add()}
          disabled={busy}
        >
          <Video className="size-4 shrink-0" />
          <span className="truncate">{t.addZentraMeet}</span>
        </Button>
      )}
      {/*
        Say what the button does. "Add Zentra Meet" alone does not tell a
        first-time organiser that a room is created and its link travels with
        the invitation.
      */}
      {!meeting ? (
        <p className="text-xs text-muted-foreground">{t.addZentraMeetHelp}</p>
      ) : null}
    </div>
  )
}
