'use client'

import { useCallback } from 'react'
import {
  readEncryptedLocalStorage,
  writeEncryptedLocalStorage,
} from '@zntr/utils/useLocalStorage'
import { toast } from 'sonner'
import { useLanguage } from '@zntr/i18n/calendar'
import { translations } from '@zntr/i18n/calendar'
import type { CalendarEvent } from '@/components/app/calendar'

interface UseEventOperationsOptions {
  events: CalendarEvent[]
  setEvents: (
    events: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[]),
  ) => void
}

export function useEventOperations({
  events,
  setEvents,
}: UseEventOperationsOptions) {
  const [language] = useLanguage()
  const t = translations[language]

  const updateEvent = useCallback(
    (updatedEvent: CalendarEvent) => {
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === updatedEvent.id ? updatedEvent : event,
        ),
      )
    },
    [setEvents],
  )

  const handleEventAdd = useCallback(
    (event: CalendarEvent) => {
      const newEvent = {
        ...event,
        id:
          event.id ||
          Date.now().toString() + Math.random().toString(36).substring(2, 9),
      }

      setEvents((prevEvents) => [...prevEvents, newEvent])
      toast(t.eventCreated)
    },
    [setEvents, t],
  )

  const handleEventUpdate = useCallback(
    (updatedEvent: CalendarEvent) => {
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === updatedEvent.id ? updatedEvent : event,
        ),
      )
      toast(t.eventUpdated)
    },
    [setEvents, t],
  )

  const handleEventDelete = useCallback(
    async (eventId: string) => {
      const targetEvent = events.find((event) => event.id === eventId)
      if (!targetEvent) return

      // Clean up shares for this event
      const storedShares = await readEncryptedLocalStorage<
        { id: string; eventId: string }[]
      >('shared-events', [])
      const relatedShares = storedShares.filter(
        (share) => share.eventId === eventId,
      )

      if (relatedShares.length > 0) {
        const results = await Promise.allSettled(
          relatedShares.map((share) =>
            fetch('/api/share', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: share.id }),
            }),
          ),
        )

        await writeEncryptedLocalStorage(
          'shared-events',
          storedShares.filter((share) => share.eventId !== eventId),
        )

        const failed = results.filter(
          (result) =>
            result.status === 'rejected' ||
            (result.status === 'fulfilled' && !result.value.ok),
        )

        if (failed.length) {
          toast.error(t.shareDeleteFailed, {
            description: t.shareDeletePartialFailedDescription,
          })
        }
      }

      setEvents((prevEvents) =>
        prevEvents.filter((event) => event.id !== targetEvent.id),
      )

      // Also clean up bookmarks
      await readEncryptedLocalStorage<{ id: string }[]>(
        'bookmarked-events',
        [],
      ).then((bookmarks) =>
        writeEncryptedLocalStorage(
          'bookmarked-events',
          bookmarks.filter((bookmark) => bookmark.id !== targetEvent.id),
        ),
      )

      toast(t.eventDeleted, {
        description: targetEvent.title,
        action: {
          label: t.undo,
          onClick: () => {
            setEvents((prevEvents) => {
              if (prevEvents.some((event) => event.id === targetEvent.id))
                return prevEvents
              return [...prevEvents, targetEvent].sort(
                (a, b) =>
                  new Date(a.startDate).getTime() -
                  new Date(b.startDate).getTime(),
              )
            })
            toast(t.deletionUndone)
          },
        },
      })
    },
    [events, t],
  )

  return { updateEvent, handleEventAdd, handleEventUpdate, handleEventDelete }
}
