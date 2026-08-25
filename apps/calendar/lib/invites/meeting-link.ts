import { getMeetingForEvent } from '@zntr/meetings'
import { getDb } from '@/lib/drizzle/client'
import { meetingUrl } from '@/lib/meetings'

/**
 * The join link for an event's Event Meeting, or undefined when it has none.
 *
 * A Series carries its Meeting on the master row (ADR-0019), so callers pass
 * the master id. Returns undefined rather than throwing: an invitation that
 * cannot resolve a meeting link is still worth sending.
 */
export async function resolveMeetingUrl(
  masterEventId: string,
): Promise<string | undefined> {
  try {
    const meeting = await getMeetingForEvent(getDb(), masterEventId)
    return meeting ? meetingUrl(meeting.id) : undefined
  } catch {
    return undefined
  }
}
