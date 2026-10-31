/**
 * What a room knows about the calendar event it belongs to.
 *
 * Resolved once on the server and passed down, so no component has to fetch
 * it. Times are ISO strings because they cross the server/client boundary and
 * must be formatted in the viewer's timezone, not the server's.
 */
export interface RoomEventContext {
  title: string
  /** Null for a recurring event, whose master row holds an anchor, not a time. */
  startsAt: string | null
  endsAt: string | null
  recurring: boolean
}
