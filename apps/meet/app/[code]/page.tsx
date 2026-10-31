import { notFound } from 'next/navigation'
import {
  getEventContextForMeeting,
  getMeeting,
  isJoinable,
} from '@zntr/meetings'
import { RoomExperience } from '@/components/room/room-experience'
import { MeetingClosed } from '@/components/room/meeting-closed'
import { getDb } from '@/lib/drizzle'
import { getServerSession } from '@/lib/auth/server'
import { isOrganiser } from '@/lib/organiser'
import { readEventTitle } from '@/lib/event-title'
import { isVideoCodec } from '@/lib/types'
import { isRoomCode } from '@/lib/room-code'
import type { RoomEventContext } from '@/lib/event-context'
import type { VideoCodec } from 'livekit-client'

interface RoomPageProps {
  params: Promise<{ code: string }>
  searchParams: Promise<{
    codec?: string
    hq?: string
    region?: string
  }>
}

export default async function RoomPage({
  params,
  searchParams,
}: RoomPageProps) {
  const { code } = await params
  // Codes always contain a hyphen, so they can never shadow a reserved path
  // (ADR 0019). One owner of that pattern: lib/room-code.ts.
  if (!isRoomCode(code)) notFound()

  const query = await searchParams
  const codec: VideoCodec =
    query.codec && isVideoCodec(query.codec) ? query.codec : 'vp9'
  const hq = query.hq === 'true'

  const db = getDb()
  const meeting = await getMeeting(db, code)
  const session = await getServerSession()

  if (!meeting) {
    return <MeetingClosed code={code} reason="missing" />
  }
  if (!isJoinable(meeting)) {
    // One predicate everywhere (isOrganiser), rather than a local re-derivation
    // that only knew about signed-in owners. A guest Organiser's Creator Token
    // lives in their browser, so the server cannot see it here — the client
    // resolves that half and the reopen endpoint re-checks it either way.
    const viewerIsOrganiser = await isOrganiser(meeting)
    return (
      <MeetingClosed
        code={code}
        reason={meeting.endedAt ? 'ended' : 'expired'}
        canReopen={viewerIsOrganiser && meeting.endedAt !== null}
      />
    )
  }

  // Show what this meeting IS, not just its code. Read in-process rather than
  // over HTTP (ADR-0017), and resolved here so the room never has to ask.
  let eventContext: RoomEventContext | undefined
  if (meeting.eventId) {
    const context = await getEventContextForMeeting(db, code)
    if (context) {
      eventContext = {
        title: readEventTitle(context.eventId, context.title),
        // A Series' anchor date is not this sitting's time (ADR-0019: one
        // Meeting per Series), and expanding occurrences belongs to the
        // calendar's recurrence engine. Better to show no time than a wrong one.
        startsAt: context.isSeries ? null : context.startDate.toISOString(),
        endsAt: context.isSeries ? null : context.endDate.toISOString(),
        recurring: context.isSeries,
      }
    }
  }

  return (
    <RoomExperience
      roomName={code}
      options={{ codec, hq, region: query.region }}
      userName={session?.user.name}
      eventContext={eventContext}
    />
  )
}
