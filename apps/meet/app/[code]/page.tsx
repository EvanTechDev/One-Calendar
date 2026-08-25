import { notFound } from 'next/navigation'
import { getMeeting, isJoinable } from '@zntr/meetings'
import { RoomExperience } from '@/components/room/room-experience'
import { MeetingClosed } from '@/components/room/meeting-closed'
import { getDb } from '@/lib/drizzle'
import { getServerSession } from '@/lib/auth/server'
import { isOrganiser } from '@/lib/organiser'
import { isVideoCodec } from '@/lib/types'
import type { VideoCodec } from 'livekit-client'

/** Room codes are `xxxx-xxxx`, so they can never shadow a reserved path. */
const ROOM_CODE_PATTERN = /^[a-z0-9]{4}-[a-z0-9]{4}$/

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
  if (!ROOM_CODE_PATTERN.test(code)) notFound()

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

  return (
    <RoomExperience
      roomName={code}
      options={{ codec, hq, region: query.region }}
      userName={session?.user.name}
    />
  )
}
