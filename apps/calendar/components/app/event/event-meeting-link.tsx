'use client'

import type { ReactNode } from 'react'
import { Copy, ExternalLink, Video } from 'lucide-react'
import { Button } from '@zntr/ui/button'
import { toast } from 'sonner'
import { translations, useLanguage } from '@zntr/i18n/calendar'
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
  const [language] = useLanguage()
  const t = translations[language]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(meeting.url)
      toast.success(t.meetingLinkCopied)
    } catch {
      toast.error(t.copyMeetingLinkFailed)
    }
  }

  if (urgent) {
    // `flex-wrap`, and the status caption is allowed to truncate: the join label
    // and the caption are both sentences in most locales ("Bli med nå" + "Skjer
    // nå", "Συμμετοχή τώρα" + "Συμβαίνει τώρα"), and on one line they pushed the
    // copy button out of the row. Wrapping keeps every control reachable instead
    // of clipping the last one.
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Button type="button" size="sm" className="min-w-0" asChild>
          <a href={meeting.url} target="_blank" rel="noopener noreferrer">
            <Video className="size-3.5 shrink-0" />
            <span className="truncate">
              {live ? t.joinMeetingNow : t.joinMeeting}
            </span>
          </a>
        </Button>
        {live ? (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="relative flex size-1.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
            </span>
            <span className="truncate">{t.meetingHappeningNow}</span>
          </span>
        ) : (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {t.meetingStartingSoon}
          </span>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto size-7 shrink-0"
          onClick={copy}
          aria-label={t.copyMeetingLink}
        >
          <Copy className="size-3.5" />
        </Button>
        {actions}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/*
        A room code is `xxxx-xxxx` (ADR-0019) — a code, not prose.

        `text-sm` is the popover's own base size, so the code sits on the same
        step as every other metadata row in the event preview (location,
        calendar, recurrence, reminder); at `text-xs` it read as a footnote
        beside them. No new size is introduced. `tabular-nums` keeps the two
        halves the same width, which proportional digits did not. `select-all`
        selects the whole code in one click for anyone who would rather read it
        than press Copy, and `truncate` is gone: nine characters never overflow,
        and clipping a credential is worse than not showing it.
      */}
      <span className="min-w-0 flex-1 select-all font-mono text-sm tabular-nums">
        {meeting.id}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7 shrink-0"
        onClick={copy}
        aria-label={t.copyMeetingLink}
      >
        <Copy className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7 shrink-0"
        asChild
        aria-label={t.joinMeeting}
      >
        <a href={meeting.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-3.5" />
        </a>
      </Button>
      {actions}
    </div>
  )
}
