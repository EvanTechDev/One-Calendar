import { videoCodecs } from 'livekit-client'
import type { VideoCodec } from 'livekit-client'

export interface ConnectionDetails {
  serverUrl: string
  roomName: string
  participantName: string
  participantToken: string
}

export interface RoomPageOptions {
  codec: VideoCodec
  hq: boolean
  region?: string
}

export function isVideoCodec(codec: string): codec is VideoCodec {
  return videoCodecs.includes(codec as VideoCodec)
}
