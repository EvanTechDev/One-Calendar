'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export interface MeetingInfo {
  id: string
  url: string
}

/**
 * The Meeting an event editor session is working on.
 *
 * "Add Zentra Meet" creates the room immediately, so the link is copyable
 * before the event is saved — that is what Google Calendar does, and ADR-0018
 * makes Google the default answer for this integration. A meeting created for
 * an event that does not exist yet is *provisional*: the server gives it an
 * expiry, so the ADR-0018 sweep collects it if this browser never gets to say
 * anything again.
 *
 * The lifecycle this hook owns is the one thing here that can lose data, so it
 * is stated explicitly:
 *
 * | Editor session          | On close                                        |
 * | ----------------------- | ----------------------------------------------- |
 * | New event, meeting added, not saved | provisional row deleted (Google: the meeting dies with the unsaved event) |
 * | New event, saved        | nothing — the save committed the row             |
 * | Existing event whose meeting was already saved | NOTHING. Deleting it would destroy a link participants hold. |
 * | Existing event, meeting added this session, editor closed without saving | provisional row deleted |
 * | Tab killed / navigated away | no code runs; the expiry + ADR-0018 sweep is the answer |
 *
 * A closing editor cannot re-read the database to decide which case it is in,
 * so it does not try: the cleanup call is always the *provisional* delete, whose
 * `expiresAt IS NOT NULL` predicate lives in SQL. The database refuses to
 * delete a committed Event Meeting no matter what this hook believes.
 */
export interface EventMeetingDraft {
  meeting: MeetingInfo | null
  /** True while a create or remove request is in flight. */
  busy: boolean
  /** Creates the room now, for the event id the editor will save under. */
  add: () => Promise<void>
  /** The organiser's explicit removal — deletes the room outright. */
  remove: () => Promise<void>
  /**
   * Called by the editor when it SAVES, before it closes.
   *
   * Saving closes the editor, and the close is what runs the cleanup — so
   * without this the dismissal path would race the save and could delete the
   * very meeting the save was about to commit. This disarms it; the events route
   * commits the row server-side.
   *
   * If the save then fails, the row simply stays provisional and expires. That
   * is the honest outcome: there is no event for it to belong to.
   */
  keep: () => void
}

/**
 * @param eventId The id the Meeting attaches to. For an existing event, the
 *   series master (a Series gets one Meeting, ADR-0019); for a draft, the id the
 *   editor will save under, which the client owns.
 * @param existingMeeting The meeting already on the event, carried in the event
 *   payload. Undefined/null means none.
 * @param isNewEvent True while the event has no row yet, which is what makes a
 *   meeting created now provisional.
 * @param open The editor's open state — closing it runs the cleanup.
 */
export function useEventMeetingDraft(
  eventId: string | null,
  existingMeeting: MeetingInfo | null,
  isNewEvent: boolean,
  open: boolean,
): EventMeetingDraft {
  const [created, setCreated] = useState<MeetingInfo | null>(null)
  const [busy, setBusy] = useState(false)

  const meeting = created ?? existingMeeting

  /**
   * What to clean up when the editor closes, in a ref rather than state: the
   * cleanup effect must not re-run when this changes, only when `open` does.
   * Holding the id (not just a boolean) means cleanup still targets the right
   * event after the editor has moved on.
   */
  const provisionalRef = useRef<string | null>(null)

  /**
   * The in-flight guard, in a ref rather than reading `busy`.
   *
   * `busy` is state, so a second click in the same tick still sees `false` — the
   * button's `disabled` never gets a chance to re-render between them. The
   * server is idempotent (it returns the existing room for an event that has
   * one), so a double POST leaked no rows, but it did race two responses into
   * `setCreated`.
   */
  const inFlightRef = useRef(false)

  // A fresh editor session starts with no meeting of its own. Keyed on the
  // event id as well as `open` so switching directly from one event's editor to
  // another's — which does not close the popover — cannot show the first
  // event's room on the second.
  useEffect(() => {
    setCreated(null)
  }, [eventId, open])

  useEffect(() => {
    if (open) return
    const eventToClean = provisionalRef.current
    provisionalRef.current = null
    if (!eventToClean) return
    // Fire-and-forget on purpose: the editor is gone, there is no surface left
    // to report to, and the expiry means a failure here degrades to "swept
    // later" rather than "leaked forever".
    void fetch('/api/meetings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: eventToClean, provisional: true }),
    }).catch(() => {})
  }, [open])

  const add = useCallback(async () => {
    if (!eventId || inFlightRef.current) return
    inFlightRef.current = true
    setBusy(true)
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, provisional: isNewEvent }),
      })
      if (!response.ok) throw new Error('create failed')
      const body = (await response.json()) as { meeting: MeetingInfo }
      setCreated(body.meeting)
      // Only a meeting THIS session created is ever a cleanup candidate, and
      // only while the event is still a draft. An existing event's meeting is
      // committed the moment it is created, so closing the editor leaves it be.
      if (isNewEvent) provisionalRef.current = eventId
    } catch {
      toast.error('Could not add the meeting')
    } finally {
      inFlightRef.current = false
      setBusy(false)
    }
  }, [eventId, isNewEvent])

  const remove = useCallback(async () => {
    if (!eventId || inFlightRef.current) return
    inFlightRef.current = true
    setBusy(true)
    try {
      const response = await fetch('/api/meetings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        // Not provisional: this is the organiser deliberately ending the
        // arrangement, so the room goes whether or not it was committed.
        body: JSON.stringify({ eventId, provisional: isNewEvent }),
      })
      if (!response.ok) throw new Error('remove failed')
      setCreated(null)
      // Removed by hand — there is nothing left for the close to clean up, and
      // leaving the id armed would issue a second, pointless DELETE.
      provisionalRef.current = null
    } catch {
      toast.error('Could not remove the meeting')
    } finally {
      inFlightRef.current = false
      setBusy(false)
    }
  }, [eventId, isNewEvent])

  const keep = useCallback(() => {
    provisionalRef.current = null
  }, [])

  return { meeting, busy, add, remove, keep }
}
