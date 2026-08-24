import { RoomExperience } from '@/components/room/room-experience'
import { getServerSession } from '@/lib/auth/server'
import { isVideoCodec } from '@/lib/types'
import type { VideoCodec } from 'livekit-client'

interface RoomPageProps {
  params: Promise<{ roomName: string }>
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
  const { roomName } = await params
  const query = await searchParams

  const codec: VideoCodec =
    query.codec && isVideoCodec(query.codec) ? query.codec : 'vp9'
  const hq = query.hq === 'true'
  const session = await getServerSession()

  return (
    <RoomExperience
      roomName={decodeURIComponent(roomName)}
      options={{ codec, hq, region: query.region }}
      userName={session?.user.name}
    />
  )
}
